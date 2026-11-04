/**
 * `note pin <id>` / `note unpin <id>` (sprint 039-CL): a pinned note sits at the top of its
 * contract's list in the app (and of the client view), most recently pinned first. Pinning is not
 * an edit: the note's `updatedAt` stays, so no editor open on it sees a conflict.
 */

import { ApiError } from '../lib/api.mjs';
import { UsageError } from '../lib/args.mjs';
import { ReferenceError_ } from '../lib/resolve.mjs';
import { notePath } from '../lib/note-fetch.mjs';

/** The pin marker `notes` prints in front of a pinned note */
export const PIN_MARKER = '📌';

function notePinner(pinned) {
	const verb = pinned ? 'pin' : 'unpin';
	return async ({ api, print, positionals }) => {
		const noteId = positionals[0];
		if (!noteId) throw new UsageError(`Usage: chronolog note ${verb} <note-id>`);
		let result;
		try {
			result = await api.put(`${notePath(noteId)}/pin`, { pinned });
		} catch (failure) {
			if (failure instanceof ApiError && failure.status === 404) {
				throw new ReferenceError_(`No note ${noteId} (or it is in the trash).`);
			}
			throw failure;
		}
		print(pinned ? `${PIN_MARKER} Pinned ${result.note.id}: it stays at the top of its list.` : `Unpinned ${result.note.id}.`, result.note);
	};
}

export const notePin = notePinner(true);
export const noteUnpin = notePinner(false);
