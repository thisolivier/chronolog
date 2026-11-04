/**
 * Replaying the outbox against the server (sprint 045-CL). Plain TypeScript with the HTTP calls
 * injected (`ReplayTransport`), so ordering, ID remapping and holds are unit tested.
 *
 * Phase 1 creates the notes made offline, so every temp note ID has its real ID before anything
 * that links to it is sent. Phase 2 sends the rest in queue order. A network failure stops the
 * replay with everything still queued; a conflict or a refusal holds that item for the user.
 * An item edited while its request was in flight is kept, rebased on what was sent.
 */
import type { CreateTimeEntryInput, TimeEntryFields } from '$lib/services/types';
import { planEntryDelete, planEntryUpdate, planNoteUpdate, type ServerEntry, type ServerNote } from './outbox-merge';
import { applyIdMapping, replaceTempIds, tempIdsIn } from './outbox-queue';
import type { HoldInfo, NoteFieldValues, OutboxItem, OutboxState } from './outbox-types';

export interface ReplayTransport {
	/** The signed-in account on the server (`GET /api/me`), or null when signed out */
	currentUserId(): Promise<string | null>;
	/** `clientId` makes the create idempotent: a repeat returns the first note */
	createNote(contractId: string, fields: NoteFieldValues, clientId: string): Promise<{ id: string; updatedAt: string }>;
	/** null when the note is gone (deleted, in the trash, not found) */
	getNote(noteId: string): Promise<ServerNote | null>;
	/** Rejects with a 409 when `expectedUpdatedAt` is stale */
	putNote(noteId: string, body: NoteFieldValues & { expectedUpdatedAt: string }): Promise<{ updatedAt: string }>;
	createEntry(input: CreateTimeEntryInput, clientId: string): Promise<{ id: string }>;
	getEntry(entryId: string): Promise<ServerEntry | null>;
	putEntry(entryId: string, body: Partial<TimeEntryFields>): Promise<void>;
	deleteEntry(entryId: string): Promise<void>;
}

/** Synchronous read-modify-write access to the persisted queue */
export interface OutboxAccess {
	read(): OutboxState;
	update(mutate: (state: OutboxState) => void): void;
}

export type ErrorKind = 'network' | 'session' | 'conflict' | 'refused';

export interface ReplayHooks {
	classifyError(error: unknown): ErrorKind;
	/** The queue's account: nothing is sent while the server has another one signed in */
	ownerUserId?: string;
	now(): string;
	/** A temp ID got its real ID (note or entry) */
	onRemapped?(tempId: string, realId: string, type: 'note' | 'entry'): void;
	/** An item reached the server */
	onReplayed?(type: 'note' | 'entry', id: string): void;
	/** A note now has `toUpdatedAt`; editors based on any of `fromUpdatedAt` may continue from it */
	onNoteUpdated?(noteId: string, fromUpdatedAt: string[], toUpdatedAt: string): void;
}

export type ReplayResult = { replayed: number; held: number; stoppedBy: 'network' | 'session' | 'other-account' | null };

class StopReplay extends Error {
	constructor(readonly reason: 'network' | 'session' | 'other-account') {
		super(reason);
	}
}

const MAX_ATTEMPTS_PER_ITEM = 3;

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export async function replayOutbox(access: OutboxAccess, transport: ReplayTransport, hooks: ReplayHooks): Promise<ReplayResult> {
	const result: ReplayResult = { replayed: 0, held: 0, stoppedBy: null };
	const attempts = new Map<number, number>();

	const findItem = (sequence: number) => access.read().items.find((item) => item.sequence === sequence);

	const hold = (sequence: number, info: Omit<HoldInfo, 'heldAt'>) => {
		access.update((state) => {
			const item = state.items.find((candidate) => candidate.sequence === sequence);
			if (!item) return;
			item.status = 'held';
			item.hold = { ...info, heldAt: hooks.now() };
		});
		result.held += 1;
	};

	/** Network and session errors stop the replay; a refusal holds the item */
	const fail = (sequence: number, error: unknown) => {
		const kind = hooks.classifyError(error);
		if (kind === 'network' || kind === 'session') throw new StopReplay(kind);
		hold(sequence, { reason: 'refused', message: `The server refused this change: ${errorMessage(error)}` });
	};

	const remap = (tempId: string, realId: string, type: 'note' | 'entry') => {
		access.update((state) => applyIdMapping(state, tempId, realId));
		hooks.onRemapped?.(tempId, realId, type);
	};

	/**
	 * True while a create this item depends on (a linked temp note, or the entry a queued delete or
	 * edit names by its temp ID) has not reached the server
	 */
	const isBlocked = (item: OutboxItem, state: OutboxState) => {
		const ownTempId = item.kind === 'note-create' || item.kind === 'entry-create' ? item.tempId : null;
		const text = JSON.stringify(item.kind === 'note-create' ? item.fields : item);
		return tempIdsIn(text).some(
			(tempId) =>
				tempId !== ownTempId &&
				!state.idMap[tempId] &&
				state.items.some(
					(other) =>
						other.sequence !== item.sequence &&
						(other.kind === 'note-create' || other.kind === 'entry-create') &&
						other.tempId === tempId
				)
		);
	};

	const setInFlight = (sequence: number, inFlight: boolean) =>
		access.update((state) => {
			const item = state.items.find((candidate) => candidate.sequence === sequence);
			if (item) item.inFlight = inFlight || undefined;
		});

	try {
		// Only ever as the account the changes were made in (review fix 5b)
		if (hooks.ownerUserId) {
			let signedIn: string | null;
			try {
				signedIn = await transport.currentUserId();
			} catch (error) {
				const kind = hooks.classifyError(error);
				throw new StopReplay(kind === 'session' ? 'session' : 'network');
			}
			if (signedIn !== hooks.ownerUserId) return { ...result, stoppedBy: 'other-account' };
		}
		// Re-apply known ID mappings: another tab may have written an item before seeing one
		access.update((state) => {
			for (const [tempId, realId] of Object.entries(state.idMap)) applyIdMapping(state, tempId, realId);
		});

		// Phase 1: notes created offline get their real IDs
		for (const item of access.read().items) {
			if (item.kind !== 'note-create' || item.status !== 'pending' || item.realId) continue;
			const sentRevision = item.revision;
			const contentReady = !isBlocked(item, access.read());
			const fields = contentReady ? withRealIds(item.fields, access.read().idMap) : {};
			setInFlight(item.sequence, true);
			try {
				const created = await transport.createNote(item.contractId, fields, item.tempId);
				access.update((state) => {
					const current = state.items.find((candidate) => candidate.sequence === item.sequence);
					if (current?.kind !== 'note-create') return;
					current.realId = created.id;
					current.realUpdatedAt = created.updatedAt;
				});
				remap(item.tempId, created.id, 'note');
				if (contentReady && findItem(item.sequence)?.revision === sentRevision) {
					access.update((state) => {
						state.items = state.items.filter((candidate) => candidate.sequence !== item.sequence);
					});
					hooks.onNoteUpdated?.(created.id, [item.queuedAt], created.updatedAt);
					hooks.onReplayed?.('note', created.id);
					result.replayed += 1;
				}
			} catch (error) {
				setInFlight(item.sequence, false);
				fail(item.sequence, error);
			}
			setInFlight(item.sequence, false);
		}

		// Phase 2: everything else, in queue order
		for (;;) {
			const state = access.read();
			const next = state.items.find(
				(item) =>
					item.status === 'pending' &&
					(attempts.get(item.sequence) ?? 0) < MAX_ATTEMPTS_PER_ITEM &&
					!(item.kind === 'note-create' && !item.realId) &&
					!isBlocked(item, state)
			);
			if (!next) break;
			attempts.set(next.sequence, (attempts.get(next.sequence) ?? 0) + 1);
			const outcome = await replayItem(next, transport, hooks, access, hold, fail, remap, setInFlight);
			if (outcome) result.replayed += 1;
		}
	} catch (error) {
		if (error instanceof StopReplay) result.stoppedBy = error.reason;
		else throw error;
	}
	return result;
}

function withRealIds(fields: NoteFieldValues, idMap: Record<string, string>): NoteFieldValues {
	const mapped: NoteFieldValues = {};
	for (const [field, value] of Object.entries(fields)) {
		if (value !== undefined) (mapped as Record<string, string>)[field] = replaceTempIds(value, idMap);
	}
	return mapped;
}

/** Remove the item if unchanged since it was sent; else keep it, rebased on what was sent */
function finishItem(access: OutboxAccess, sent: OutboxItem, rebase: (current: OutboxItem) => void): void {
	access.update((state) => {
		const current = state.items.find((item) => item.sequence === sent.sequence);
		if (!current) return;
		if (current.revision === sent.revision) {
			state.items = state.items.filter((item) => item.sequence !== sent.sequence);
		} else {
			rebase(current);
		}
	});
}

async function replayItem(
	item: OutboxItem,
	transport: ReplayTransport,
	hooks: ReplayHooks,
	access: OutboxAccess,
	hold: (sequence: number, info: Omit<HoldInfo, 'heldAt'>) => void,
	fail: (sequence: number, error: unknown) => void,
	remap: (tempId: string, realId: string, type: 'note' | 'entry') => void,
	setInFlight: (sequence: number, inFlight: boolean) => void
): Promise<boolean> {
	const idMap = access.read().idMap;
	const realId = (id: string) => idMap[id] ?? id;
	try {
		switch (item.kind) {
			case 'note-create': {
				// Phase 2 of a note created in phase 1 without its content (it linked a newer temp note)
				const noteId = item.realId as string;
				const fields = withRealIds(item.fields, idMap);
				try {
					const saved = await transport.putNote(noteId, { ...fields, expectedUpdatedAt: item.realUpdatedAt ?? '' });
					finishItem(access, item, (current) => {
						if (current.kind === 'note-create') current.realUpdatedAt = saved.updatedAt;
					});
					// An editor may hold the queued time or the create's answer as its base
					const superseded = [item.queuedAt, item.realUpdatedAt].filter((value): value is string => Boolean(value));
					hooks.onNoteUpdated?.(noteId, superseded, saved.updatedAt);
					hooks.onReplayed?.('note', noteId);
					return true;
				} catch (error) {
					if (hooks.classifyError(error) !== 'conflict') throw error;
					hold(item.sequence, {
						reason: 'conflict',
						message: 'This new note was changed on the server before its text arrived.',
						conflictFields: ['content'],
						server: (await transport.getNote(noteId)) as Record<string, unknown> | null
					});
					return false;
				}
			}
			case 'note-update': {
				const noteId = realId(item.noteId);
				const server = await transport.getNote(noteId);
				if (!server) {
					hold(item.sequence, {
						reason: 'refused',
						message: 'This note was deleted on the server (it may be in the trash).',
						server: null
					});
					return false;
				}
				const plan = planNoteUpdate({ ...item, changes: withRealIds(item.changes, idMap) }, server);
				if (plan.action === 'hold') {
					hold(item.sequence, {
						reason: 'conflict',
						message: 'This note was also changed on the server.',
						conflictFields: plan.conflictFields,
						server: server as unknown as Record<string, unknown>
					});
					return false;
				}
				let newUpdatedAt = server.updatedAt;
				if (plan.action === 'send') {
					try {
						newUpdatedAt = (await transport.putNote(noteId, plan.body)).updatedAt;
					} catch (error) {
						// Changed again between the read and the write: try the item again
						if (hooks.classifyError(error) === 'conflict') return false;
						throw error;
					}
				}
				const sentValues = { ...item.base, ...item.changes };
				finishItem(access, item, (current) => {
					if (current.kind !== 'note-update') return;
					current.baseUpdatedAt = newUpdatedAt;
					current.base = sentValues;
				});
				hooks.onNoteUpdated?.(noteId, item.baseUpdatedAt ? [item.baseUpdatedAt] : [], newUpdatedAt);
				hooks.onReplayed?.('note', noteId);
				return true;
			}
			case 'entry-create': {
				const input = { ...item.input };
				if (input.description) input.description = replaceTempIds(input.description, idMap);
				setInFlight(item.sequence, true);
				let created: { id: string };
				try {
					created = await transport.createEntry(input, item.tempId);
				} finally {
					setInFlight(item.sequence, false);
				}
				finishItem(access, item, (current) => {
					if (current.kind !== 'entry-create') return;
					// Edited while the create was in flight: the rest goes as an update
					const changes = { ...current.input } as Partial<TimeEntryFields>;
					Object.assign(current, {
						kind: 'entry-update',
						entryId: created.id,
						base: { ...item.input },
						changes,
						displayPatch: current.display
					});
				});
				remap(item.tempId, created.id, 'entry');
				hooks.onReplayed?.('entry', created.id);
				return true;
			}
			case 'entry-update': {
				const entryId = realId(item.entryId);
				const server = await transport.getEntry(entryId);
				if (!server) {
					hold(item.sequence, { reason: 'refused', message: 'This time entry was deleted on the server.', server: null });
					return false;
				}
				const changes = { ...item.changes };
				if (typeof changes.description === 'string') changes.description = replaceTempIds(changes.description, idMap);
				const plan = planEntryUpdate({ base: item.base, changes }, server);
				if (plan.action === 'hold') {
					hold(item.sequence, {
						reason: 'conflict',
						message: 'This time entry was also changed on the server.',
						conflictFields: plan.conflictFields,
						server: server as Record<string, unknown>
					});
					return false;
				}
				if (plan.action === 'send') await transport.putEntry(entryId, plan.body);
				finishItem(access, item, (current) => {
					if (current.kind === 'entry-update') current.base = { ...current.base, ...changes };
				});
				hooks.onReplayed?.('entry', entryId);
				return true;
			}
			case 'entry-delete': {
				const entryId = realId(item.entryId);
				const server = await transport.getEntry(entryId);
				const plan = planEntryDelete(item, server);
				if (plan.action === 'hold') {
					hold(item.sequence, {
						reason: 'conflict',
						message: 'You deleted this time entry, but it was changed on the server meanwhile.',
						conflictFields: plan.conflictFields,
						server: server as Record<string, unknown>
					});
					return false;
				}
				if (plan.action === 'send') await transport.deleteEntry(entryId);
				finishItem(access, item, () => {});
				return true;
			}
		}
	} catch (error) {
		fail(item.sequence, error);
		return false;
	}
}
