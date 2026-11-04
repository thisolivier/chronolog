/**
 * Commands that change or remove a note (sprint 034-CL): note edit, note append, note delete,
 * note restore.
 *
 * Edit and append read the note, then `PATCH` it with the `updatedAt` they read. When the owner
 * changed the note in the app in between, the server answers 409 and the command exits 7 without
 * retrying, so the browser's text is never overwritten. They send markdown only: the server then
 * drops the note's TipTap JSON so the editor reloads from the new markdown.
 *
 * Delete moves the note to the server's trash (sprint 037-CL): it keeps its id, links and time-entry
 * links, and `note restore <id>` brings it back as it was within 30 days. `note restore` with no id
 * lists the trash. (Sprint 034's local `trash/<id>.md` copies are no longer written or read.)
 */

import { ApiError } from '../lib/api.mjs';
import { UsageError } from '../lib/args.mjs';
import { confirmRemoval } from '../lib/confirm.mjs';
import { ReferenceError_, resolveContract } from '../lib/resolve.mjs';
import { appendedContent, countWords, editedContent, headingTitle, readBody } from '../lib/note-body.mjs';
import { fetchContracts } from './read.mjs';

/** The note changed on the server after this command read it (exit 7). */
export class NoteChanged extends Error {
	constructor(noteId, serverUpdatedAt) {
		super('note changed on the server since it was read; re-run');
		this.code = 'note_changed';
		this.status = 409;
		this.noteId = noteId;
		this.serverUpdatedAt = serverUpdatedAt;
	}
}

const notePath = (noteId) => `/api/notes/${encodeURIComponent(noteId)}`;

export async function fetchNote(api, noteId) {
	return (await api.get(notePath(noteId))).note;
}

/**
 * `--expected-updated-at` pins the copy the caller showed the owner (the `updatedAt` from an
 * earlier `note show`); without it, the copy this command just read.
 */
export async function patchNote(api, note, changes, flags) {
	const expectedUpdatedAt = typeof flags.expectedUpdatedAt === 'string' ? flags.expectedUpdatedAt : note.updatedAt;
	try {
		return (await api.patch(notePath(note.id), { ...changes, expectedUpdatedAt })).note;
	} catch (failure) {
		if (failure instanceof ApiError && failure.status === 409 && failure.code !== 'duplicate') {
			throw new NoteChanged(note.id);
		}
		throw failure;
	}
}

async function contractLabel(api, contractId) {
	const { contracts } = await api.get('/api/contracts-by-client?includeArchived=true');
	const contract = contracts.find((candidate) => candidate.id === contractId);
	return contract ? `${contract.clientShortCode}/${contract.name}` : contractId;
}

export async function noteEdit({ api, print, positionals, flags, stdin = process.stdin }) {
	const noteId = positionals[0];
	if (!noteId) throw new UsageError('Usage: chronolog note edit <note-id> [--title "..."] [--contract <ref>] [--file body.md | body on stdin]');
	const bodyText = readBody(flags, stdin);
	const body = bodyText.trim() ? bodyText.trim() : undefined;
	const title = typeof flags.title === 'string' ? flags.title.trim() : undefined;
	if (title === '') throw new UsageError('--title cannot be empty.');
	if (body === undefined && title === undefined && !flags.contract) {
		throw new UsageError('Nothing to change: give --title, --contract, or a body (--file or stdin).');
	}

	const note = await fetchNote(api, noteId);
	const changes = {};
	if (body !== undefined || title !== undefined) {
		changes.content = editedContent(note, { title, body });
		changes.title = headingTitle(changes.content) ?? title ?? note.title ?? '';
	}
	let movedTo = '';
	if (flags.contract) {
		const contract = resolveContract(flags.contract, await fetchContracts(api));
		if (contract.id !== note.contractId) {
			changes.contractId = contract.id;
			movedTo = ` and moved to ${contract.clientShortCode}/${contract.name}`;
		}
	}
	if (Object.keys(changes).length === 0) {
		print(`Note ${note.id} is already on that contract; nothing changed.`, note);
		return;
	}
	const updated = await patchNote(api, note, changes, flags);
	print(`Updated note ${updated.id}: ${updated.title ?? '(untitled)'}${movedTo}`, updated);
}

export async function noteAppend({ api, print, positionals, flags, stdin = process.stdin }) {
	const noteId = positionals[0];
	const text = readBody(flags, stdin).trim();
	if (!noteId || !text) throw new UsageError('Usage: chronolog note append <note-id> [--file text.md]  (or pipe the text on stdin)');
	const note = await fetchNote(api, noteId);
	const updated = await patchNote(api, note, { content: appendedContent(note.content, text) }, flags);
	print(`Appended ${countWords(text)} words to note ${updated.id}: ${updated.title ?? '(untitled)'}`, updated);
}

export async function noteDelete({ api, print, positionals, flags, stdin = process.stdin, stdout = process.stderr }) {
	const noteId = positionals[0];
	if (!noteId) throw new UsageError('Usage: chronolog note delete <note-id> [--yes]');
	const note = await fetchNote(api, noteId);
	const contract = await contractLabel(api, note.contractId);
	const words = countWords(note.content);
	await confirmRemoval({
		flags,
		summary: `Note ${note.id} “${note.title ?? '(untitled)'}” in ${contract}, ${words} words.`,
		question: 'Move it to the trash?',
		refusal: 'Not deleted: confirm with the owner, then run again with --yes.',
		stdin,
		stdout
	});

	const deleted = await api.delete(notePath(note.id));
	print(
		`Deleted note ${note.id} “${note.title ?? '(untitled)'}” from ${contract}.\nRestore with \`chronolog note restore ${note.id}\` within 30 days.`,
		{
			deleted: {
				id: deleted.id,
				title: deleted.title,
				contractId: deleted.contractId,
				deletedAt: deleted.deletedAt,
				purgeAt: deleted.purgeAt
			}
		}
	);
}

export async function noteRestore({ api, print, positionals }) {
	const noteId = positionals[0];
	if (!noteId) {
		const { notes } = await api.get('/api/notes/trash');
		const lines = notes.map(
			(trashed) => `${trashed.id}  deleted ${trashed.deletedAt.slice(0, 10)}  purged ${trashed.purgeAt.slice(0, 10)}  ${trashed.contract}  ${trashed.title ?? '(untitled)'}`
		);
		print([`Notes in the trash (restorable for 30 days): ${notes.length}`, ...lines].join('\n'), notes);
		return;
	}
	let restored;
	try {
		restored = await api.post(`${notePath(noteId)}/restore`, {});
	} catch (failure) {
		if (failure instanceof ApiError && failure.status === 404) {
			throw new ReferenceError_(`${noteId} is not in the trash (\`chronolog note restore\` lists it; notes are purged 30 days after deletion).`);
		}
		throw failure;
	}
	const { note, contract } = restored;
	const label = contract ? `${contract.clientShortCode}/${contract.name}` : note.contractId;
	const archived = contract?.archived ? ` (that contract is archived; \`chronolog note edit ${note.id} --contract X\` moves it)` : '';
	print(`Restored note ${note.id} “${note.title ?? '(untitled)'}” to ${label}${archived}.`, { ...note, contract });
}
