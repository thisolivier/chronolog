/**
 * Splitting the draft timer in one transaction (sprint 056-DR, design r1 SP-04/SP-08).
 *
 * The left part `start..boundary` is saved as an entry (or discarded) and the draft advances to
 * the right part `boundary..end-or-now`, together or not at all. Only the live draft can be split,
 * never a saved entry (SP-01, O13).
 *
 * Idempotency (SP-07): the request's `clientRequestId` goes on the saved left entry, and
 * `<clientRequestId>:remainder` on the advanced draft. The draft row is locked first, so a retry
 * (or the same request twice at once) waits for the first, then finds one of those marks and
 * answers with the first outcome (`replayed: true`) without writing anything. A split that
 * discarded its left part and left no server draft (blank remainder) leaves no mark: its retry
 * gets `not_found`, like any request for a draft that is gone.
 */
import { and, eq } from 'drizzle-orm';
import { database, timeEntries } from '$lib/server/db';
import { decryptNullable, encryptNullable } from '$lib/server/crypto/server-cipher';
import { isUniqueViolation } from '$lib/server/admin-actions';
import type { BatchTransaction } from '$lib/server/batch/run-batch';
import { calculateTimerDurationMinutes } from './timer-duration';
import { linkTimeEntryToNotesInTransaction, reconcileTimeEntryLinksInTransaction } from './time-entries-batch';
import { draftRefusal, lockUserEntry, type DraftRefusal } from './timer-draft';
import { extractDescriptionLinks } from '$lib/utils/reconcile-description-links';

type TimeEntryRow = typeof timeEntries.$inferSelect;

/** The advanced draft carries `<clientRequestId>:remainder`, so split ids are at most 90 characters. */
export const REMAINDER_MARK_SUFFIX = ':remainder';

type LocalMoment = { date: string; time: string };
export type EntryContent = {
	contractId: string;
	deliverableId: string | null;
	workTypeId: string | null;
	description: string | null;
};
export type SplitRequest = {
	entryId: string;
	/** `HH:MM:SS` times */
	expectedStartedAt: LocalMoment;
	boundary: LocalMoment;
	clientRequestId: string;
	left: ({ action: 'save' } & EntryContent) | { action: 'discard' };
	/** With a contract the remainder stays the server draft; without one it becomes a browser (pending) timer */
	right: { kind: 'draft'; content: EntryContent } | { kind: 'pending'; description: string | null };
};
/** The route's wall-clock rule for the locked draft (`splitBoundaryProblem`): null when the boundary fits */
export type IntervalCheck = (draft: { date: string; startTime: string | null; endTime: string | null }) => { code: string; message: string } | null;

export type SplitLeft =
	| { action: 'saved'; entry: TimeEntryRow }
	| { action: 'discarded'; date: string; startTime: string; endTime: string };
export type SplitRemainder =
	| { kind: 'draft'; timerId: string }
	| { kind: 'pending'; date: string; startTime: string; description: string | null }
	/** Replay only: the remainder draft has since been saved, discarded or split again */
	| { kind: 'gone' };
export type SplitOutcome = { ok: true; replayed: boolean; left: SplitLeft; remainder: SplitRemainder };
export type SplitRefusal = DraftRefusal | { ok: false; status: 400; code: string; message: string };

const decrypt = (row: TimeEntryRow): TimeEntryRow => ({ ...row, description: decryptNullable(row.description, 'time_entries.description') });

async function findByRequestId(transaction: BatchTransaction, userId: string, clientRequestId: string, isDraft: boolean) {
	const [row] = await transaction
		.select()
		.from(timeEntries)
		.where(and(eq(timeEntries.userId, userId), eq(timeEntries.clientRequestId, clientRequestId), eq(timeEntries.isDraft, isDraft)))
		.limit(1);
	return row ?? null;
}

function pendingRemainder(request: SplitRequest): SplitRemainder {
	return request.right.kind === 'pending'
		? { kind: 'pending', date: request.boundary.date, startTime: request.boundary.time, description: request.right.description }
		: { kind: 'gone' };
}

function discardedLeft(request: SplitRequest): SplitLeft {
	return { action: 'discarded', date: request.expectedStartedAt.date, startTime: request.expectedStartedAt.time, endTime: request.boundary.time };
}

/** The first outcome of this request, when it already happened. */
async function findReplay(transaction: BatchTransaction, userId: string, request: SplitRequest): Promise<SplitOutcome | null> {
	const savedLeft = await findByRequestId(transaction, userId, request.clientRequestId, false);
	const markedDraft = await findByRequestId(transaction, userId, `${request.clientRequestId}${REMAINDER_MARK_SUFFIX}`, true);
	if (!savedLeft && !markedDraft) return null;
	return {
		ok: true,
		replayed: true,
		left: savedLeft ? { action: 'saved', entry: decrypt(savedLeft) } : discardedLeft(request),
		remainder: markedDraft ? { kind: 'draft', timerId: markedDraft.id } : pendingRemainder(request)
	};
}

async function splitInTransaction(
	transaction: BatchTransaction,
	userId: string,
	request: SplitRequest,
	intervalProblem: IntervalCheck
): Promise<SplitOutcome | SplitRefusal> {
	const draft = await lockUserEntry(transaction, request.entryId, userId);
	const replay = await findReplay(transaction, userId, request);
	if (replay) return replay;
	const refusal = draftRefusal(draft, request.expectedStartedAt);
	if (refusal || !draft?.startTime) return refusal ?? { ok: false, status: 409, code: 'timer_changed', message: 'The timer has no start time' };

	const problem = intervalProblem(draft);
	if (problem) return { ok: false, status: 400, ...problem };

	let left: SplitLeft = discardedLeft(request);
	if (request.left.action === 'save') {
		const { contractId, deliverableId, workTypeId, description } = request.left;
		const content = { contractId, deliverableId, workTypeId, description };
		const [row] = await transaction
			.insert(timeEntries)
			.values({
				...content,
				userId,
				description: encryptNullable(content.description),
				date: draft.date,
				startTime: draft.startTime,
				endTime: request.boundary.time,
				durationMinutes: calculateTimerDurationMinutes(draft.startTime, request.boundary.time),
				isDraft: false,
				clientRequestId: request.clientRequestId
			})
			.returning();
		await linkTimeEntryToNotesInTransaction(transaction, row.id, extractDescriptionLinks(content.description ?? ''));
		left = { action: 'saved', entry: decrypt(row) };
	}

	if (request.right.kind === 'pending') {
		// A remainder with no contract cannot be a server draft: the browser keeps it (pending timer)
		await transaction.delete(timeEntries).where(eq(timeEntries.id, draft.id));
		return { ok: true, replayed: false, left, remainder: pendingRemainder(request) };
	}
	const content = request.right.content;
	await transaction
		.update(timeEntries)
		.set({
			...content,
			description: encryptNullable(content.description),
			date: request.boundary.date,
			startTime: request.boundary.time,
			// Running: 0 as when started; stopped: re-measured from the new start, as Stop does
			durationMinutes: draft.endTime ? calculateTimerDurationMinutes(request.boundary.time, draft.endTime) : 0,
			clientRequestId: `${request.clientRequestId}${REMAINDER_MARK_SUFFIX}`,
			updatedAt: new Date()
		})
		.where(eq(timeEntries.id, draft.id));
	await reconcileTimeEntryLinksInTransaction(transaction, draft.id, content.description);
	return { ok: true, replayed: false, left, remainder: { kind: 'draft', timerId: draft.id } };
}

/** Splits the draft; on any refusal nothing is written. */
export async function splitDraftTimer(
	userId: string,
	request: SplitRequest,
	intervalProblem: IntervalCheck
): Promise<SplitOutcome | SplitRefusal> {
	const run = () => database.transaction((transaction) => splitInTransaction(transaction, userId, request, intervalProblem));
	try {
		return await run();
	} catch (failure) {
		// The same clientRequestId raced in on another row: run again, which replays the first outcome
		if (!isUniqueViolation(failure)) throw failure;
		return run();
	}
}
