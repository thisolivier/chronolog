/**
 * Reading one note (sprint 037-CL): a note in the server's trash answers 404 `note_in_trash`; the
 * CLI turns that into an unknown reference (exit 3) that names the restore command.
 */
import { ApiError } from './api.mjs';
import { ReferenceError_ } from './resolve.mjs';

export const notePath = (noteId) => `/api/notes/${encodeURIComponent(noteId)}`;

export async function fetchNote(api, noteId) {
	try {
		return (await api.get(notePath(noteId))).note;
	} catch (failure) {
		if (failure instanceof ApiError && failure.code === 'note_in_trash') {
			throw new ReferenceError_(`${noteId} is in the trash: \`chronolog note restore ${noteId}\` brings it back.`);
		}
		throw failure;
	}
}
