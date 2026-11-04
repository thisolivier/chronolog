/**
 * One item of `POST /api/time-entries/batch` (sprint 038-CL): the fields and checks of
 * `POST /api/time-entries` (date, `duration` text or `durationMinutes`, or `startTime` and
 * `endTime` alone; `assertEntryReferences` for contract, deliverable and work type; `noteId`
 * appends `[[noteId]]` to the description and links the entry). Problems are thrown as
 * `BatchItemError` with the single route's codes.
 */

import { assertEntryReferences, EntryReferenceError } from '$lib/server/db/queries/entry-references';
import { createTimeEntry } from '$lib/server/db/queries/time-entries';
import { getNoteForUser, linkTimeEntryToNote } from '$lib/server/db/queries/notes';
import {
	createTimeEntryInTransaction,
	findUserNoteIdInTransaction,
	linkTimeEntryToNotesInTransaction
} from '$lib/server/db/queries/time-entries-batch';
import { extractDescriptionLinks } from '$lib/utils/reconcile-description-links';
import { BatchItemError, type BatchItemSuccess, type BatchTransaction } from '$lib/server/batch/run-batch';
import { isValidDate, readDurationFields } from '../entry-input';

const ENTRY_FIELDS = new Set([
	'contractId',
	'date',
	'duration',
	'durationMinutes',
	'startTime',
	'endTime',
	'description',
	'deliverableId',
	'workTypeId',
	'noteId'
]);

/** A 4xx Response from the shared input readers, as the item's error. */
async function itemErrorFrom(response: Response): Promise<BatchItemError> {
	const body = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
	return new BatchItemError(body.error ?? 'Invalid item', body.code ?? 'bad_request');
}

function optionalId(value: unknown, fieldName: string): string | null {
	if (value === undefined || value === null || value === '') return null;
	if (typeof value !== 'string') throw new BatchItemError(`${fieldName} must be a UUID`, 'bad_request');
	return value;
}

export function processEntryItem(context: { userId: string }) {
	return async (item: Record<string, unknown>, _index: number, transaction: BatchTransaction | null): Promise<BatchItemSuccess> => {
		const unknown = Object.keys(item).filter((key) => !ENTRY_FIELDS.has(key));
		if (unknown.length) throw new BatchItemError(`Unknown field${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`, 'bad_request');

		const { date, contractId } = item;
		const deliverableId = optionalId(item.deliverableId, 'deliverableId');
		const workTypeId = optionalId(item.workTypeId, 'workTypeId');
		if (item.description !== undefined && item.description !== null && typeof item.description !== 'string') {
			throw new BatchItemError('description must be text', 'bad_request');
		}
		let description = typeof item.description === 'string' ? item.description : '';

		// startTime and endTime without a duration mean that range
		const durationInput =
			item.duration === undefined && item.durationMinutes === undefined && typeof item.startTime === 'string' && typeof item.endTime === 'string'
				? { duration: `${item.startTime}-${item.endTime}` }
				: item;
		const durationFields = readDurationFields(durationInput);
		if (durationFields instanceof Response) throw await itemErrorFrom(durationFields);
		if (date === undefined || date === null || !durationFields || contractId === undefined || contractId === null) {
			throw new BatchItemError('Missing required fields: date, duration (or durationMinutes, or startTime and endTime), contractId', 'bad_request');
		}
		if (!isValidDate(date)) throw new BatchItemError('date must be YYYY-MM-DD', 'invalid_date');
		if (typeof contractId !== 'string') throw new BatchItemError('contractId must be a UUID', 'invalid_contract');
		try {
			await assertEntryReferences({ userId: context.userId, contractId, deliverableId, workTypeId });
		} catch (failure) {
			if (failure instanceof EntryReferenceError) throw new BatchItemError(failure.message, failure.code);
			throw failure;
		}

		const noteReference = item.noteId;
		if (noteReference !== undefined && noteReference !== null && noteReference !== '') {
			const noteId = transaction
				? await findUserNoteIdInTransaction(transaction, context.userId, String(noteReference))
				: (await getNoteForUser(String(noteReference), context.userId))?.id;
			if (!noteId) throw new BatchItemError(`Note ${noteReference} not found`, 'note_not_found');
			const reference = `[[${noteId}]]`;
			if (!description.includes(reference)) description = description ? `${description} ${reference}` : reference;
		}

		const values = {
			userId: context.userId,
			contractId,
			deliverableId,
			workTypeId,
			date,
			durationMinutes: durationFields.durationMinutes,
			description: description || null,
			startTime: (typeof item.startTime === 'string' && item.startTime) || durationFields.startTime || null,
			endTime: (typeof item.endTime === 'string' && item.endTime) || durationFields.endTime || null
		};
		const links = extractDescriptionLinks(description);

		if (transaction) {
			const entry = await createTimeEntryInTransaction(transaction, values);
			await linkTimeEntryToNotesInTransaction(transaction, entry.id, links);
			return { action: 'created', id: entry.id, updatedAt: entry.updatedAt.toISOString() };
		}
		const entry = await createTimeEntry({ ...values, isDraft: false });
		for (const link of links) {
			try {
				await linkTimeEntryToNote(link.noteId, entry.id, link.headingAnchor);
			} catch {
				// As POST /api/time-entries: a link to a note that does not exist is ignored
			}
		}
		return { action: 'created', id: entry.id, updatedAt: entry.updatedAt.toISOString() };
	};
}
