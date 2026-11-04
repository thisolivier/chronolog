/**
 * Pinning a note (sprint 039-CL). A pinned note sits at the top of its contract's list (and of the
 * client view), most recently pinned first. Pinning is not an edit: `updatedAt` does not change,
 * so an open editor's next autosave is not refused as a conflict.
 */
import { and, eq } from 'drizzle-orm';
import { database, notes } from '$lib/server/db';
import { notInTrash } from './notes';

export interface NotePinState {
	id: string;
	contractId: string;
	isPinned: boolean;
	pinnedAt: Date | null;
}

/**
 * Pin or unpin one of the user's notes (not in the trash). Pinning a pinned note keeps its
 * original `pinnedAt`, so it does not jump above notes pinned after it. Null when not found.
 */
export async function setNotePinnedForUser(
	userId: string,
	noteId: string,
	pinned: boolean,
	now: Date = new Date()
): Promise<NotePinState | null> {
	const ownedNote = and(eq(notes.id, noteId), eq(notes.userId, userId), notInTrash);
	return database.transaction(async (transaction) => {
		const current = await transaction
			.select({ pinnedAt: notes.pinnedAt })
			.from(notes)
			.where(ownedNote)
			.for('update');
		if (current.length === 0) return null;
		const pinnedAt = pinned ? (current[0].pinnedAt ?? now) : null;
		const results = await transaction
			.update(notes)
			.set({ pinnedAt, isPinned: pinned })
			.where(ownedNote)
			.returning({ id: notes.id, contractId: notes.contractId, isPinned: notes.isPinned, pinnedAt: notes.pinnedAt });
		return results[0] ?? null;
	});
}
