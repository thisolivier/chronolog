/**
 * One item of `POST /api/notes/batch` (sprint 038-CL): a create (`contractId`, as `POST
 * /api/notes`) or an update by `id` (as `PATCH /api/notes/[noteId]`, plus `append`). Problems are
 * thrown as `BatchItemError` with the codes the single routes use.
 */

import { contractBelongsToUser } from '$lib/server/db/queries/contracts';
import { createNoteForUser, getNoteForUser, NoteConflictError, updateNoteForUser } from '$lib/server/db/queries/notes';
import { createNoteInTransaction, lockNoteInTransaction, updateNoteInTransaction } from '$lib/server/db/queries/notes-batch';
import { updateNoteLinks } from '$lib/server/db/queries/note-links';
import { BatchItemError, type BatchItemSuccess, type BatchTransaction } from '$lib/server/batch/run-batch';
import { isCalendarDate, localDateString, noonInTimezone } from '$lib/utils/local-calendar';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CREATE_FIELDS = new Set(['contractId', 'title', 'content', 'createdAt']);
const UPDATE_FIELDS = new Set(['id', 'title', 'content', 'append', 'expectedUpdatedAt']);
/** An update without `expectedUpdatedAt` that appends retries this often when the note changes underneath it */
const APPEND_ATTEMPTS = 3;

export type NoteBatchContext = { userId: string; timezone: string };

/** The old text, a blank line, the new text (the CLI's `note append`). */
export function appendedContent(currentContent: string | null, text: string): string {
	const existing = (currentContent ?? '').trimEnd();
	return (existing ? `${existing}\n\n${text.trim()}` : text.trim()) + '\n';
}

function optionalText(item: Record<string, unknown>, fieldName: string): string | null | undefined {
	const value = item[fieldName];
	if (value !== undefined && value !== null && typeof value !== 'string') {
		throw new BatchItemError(`${fieldName} must be text`, 'bad_request');
	}
	return value as string | null | undefined;
}

function rejectUnknownFields(item: Record<string, unknown>, allowed: Set<string>, kind: string) {
	const unknown = Object.keys(item).filter((key) => !allowed.has(key));
	if (unknown.length) {
		throw new BatchItemError(`Unknown field${unknown.length > 1 ? 's' : ''} for ${kind}: ${unknown.join(', ')}`, 'bad_request');
	}
}

function conflict(failure: NoteConflictError): BatchItemError {
	return new BatchItemError(`Note ${failure.noteId} changed since expectedUpdatedAt; read it again`, 'conflict', {
		updatedAt: failure.currentUpdatedAt.toISOString()
	});
}

async function createNote(item: Record<string, unknown>, context: NoteBatchContext, transaction: BatchTransaction | null): Promise<BatchItemSuccess> {
	rejectUnknownFields(item, CREATE_FIELDS, 'a new note');
	const { contractId, createdAt } = item;
	if (typeof contractId !== 'string' || !UUID_PATTERN.test(contractId)) {
		throw new BatchItemError('contractId must be a UUID', 'invalid_contract');
	}
	const title = optionalText(item, 'title') ?? undefined;
	const content = optionalText(item, 'content') ?? undefined;

	const clock: { timezone: string; now?: Date } = { timezone: context.timezone };
	if (createdAt !== undefined && createdAt !== null) {
		if (typeof createdAt !== 'string' || !isCalendarDate(createdAt)) {
			throw new BatchItemError('createdAt must be a calendar date, YYYY-MM-DD', 'invalid_date');
		}
		const today = localDateString(new Date(), context.timezone);
		if (createdAt > today) throw new BatchItemError(`createdAt ${createdAt} is in the future (today is ${today})`, 'invalid_date');
		if (createdAt < today) clock.now = noonInTimezone(createdAt, context.timezone);
	}
	if (!(await contractBelongsToUser(contractId, context.userId))) {
		throw new BatchItemError('That contract does not belong to you', 'contract_forbidden');
	}

	const note = transaction
		? await createNoteInTransaction(transaction, context.userId, contractId, title, content, clock)
		: await createNoteForUser(context.userId, contractId, title, content, undefined, clock);
	return {
		action: 'created',
		id: note.id,
		updatedAt: note.updatedAt.toISOString(),
		afterCommit: content ? () => updateNoteLinks(note.id, content) : undefined
	};
}

async function updateNote(item: Record<string, unknown>, context: NoteBatchContext, transaction: BatchTransaction | null): Promise<BatchItemSuccess> {
	rejectUnknownFields(item, UPDATE_FIELDS, 'a note update');
	const noteId = item.id;
	if (typeof noteId !== 'string' || !noteId.trim()) throw new BatchItemError('id must be a note id', 'bad_request');
	const title = optionalText(item, 'title');
	const content = optionalText(item, 'content');
	const append = optionalText(item, 'append');
	const expectedText = optionalText(item, 'expectedUpdatedAt');
	if (content !== undefined && append !== undefined) {
		throw new BatchItemError('Give content (replaces the text) or append, not both', 'bad_request');
	}
	if (append !== undefined && (append === null || !append.trim())) throw new BatchItemError('append must be non-empty text', 'bad_request');
	if (title === undefined && content === undefined && append === undefined) {
		throw new BatchItemError('Nothing to change: give title, content or append', 'bad_request');
	}
	let expectedUpdatedAt: Date | undefined;
	if (expectedText) {
		expectedUpdatedAt = new Date(expectedText);
		if (Number.isNaN(expectedUpdatedAt.getTime())) throw new BatchItemError('Invalid expectedUpdatedAt', 'bad_request');
	}
	const notFound = () => new BatchItemError(`Note ${noteId} not found`, 'note_not_found');

	let saved: { id: string; updatedAt: Date; content: string | null } | null = null;
	if (transaction) {
		const locked = await lockNoteInTransaction(transaction, context.userId, noteId);
		if (!locked) throw notFound();
		const newContent = append ? appendedContent(locked.content, append) : content;
		try {
			saved = await updateNoteInTransaction(
				transaction,
				context.userId,
				noteId,
				{ title, content: newContent },
				locked.updatedAt,
				expectedUpdatedAt
			);
		} catch (failure) {
			if (failure instanceof NoteConflictError) throw conflict(failure);
			throw failure;
		}
	} else if (append) {
		for (let attempt = 1; !saved; attempt += 1) {
			const current = await getNoteForUser(noteId, context.userId);
			if (!current) throw notFound();
			try {
				saved = await updateNoteForUser(
					context.userId,
					noteId,
					title as string | undefined,
					appendedContent(current.content, append),
					undefined,
					undefined,
					expectedUpdatedAt ?? current.updatedAt
				);
				if (!saved) throw notFound();
			} catch (failure) {
				// Without expectedUpdatedAt the append is unconditional: re-read and append to the newer text
				if (!(failure instanceof NoteConflictError)) throw failure;
				if (expectedUpdatedAt || attempt >= APPEND_ATTEMPTS) throw conflict(failure);
			}
		}
	} else {
		try {
			saved = await updateNoteForUser(
				context.userId,
				noteId,
				title as string | undefined,
				content as string | undefined,
				undefined,
				undefined,
				expectedUpdatedAt
			);
		} catch (failure) {
			if (failure instanceof NoteConflictError) throw conflict(failure);
			throw failure;
		}
	}
	if (!saved) throw notFound();

	const contentChanged = content !== undefined || append !== undefined;
	const savedContent = saved.content ?? '';
	return {
		action: 'updated',
		id: saved.id,
		updatedAt: saved.updatedAt.toISOString(),
		extra: expectedUpdatedAt ? {} : { unconditional: true },
		afterCommit: contentChanged ? () => updateNoteLinks(noteId, savedContent) : undefined
	};
}

export function processNoteItem(context: NoteBatchContext) {
	return (item: Record<string, unknown>, _index: number, transaction: BatchTransaction | null) =>
		item.id !== undefined ? updateNote(item, context, transaction) : createNote(item, context, transaction);
}
