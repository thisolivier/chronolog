/**
 * Commands that change or remove a note (sprint 034-CL): note edit, note append, note delete,
 * note restore.
 *
 * Edit and append read the note, then `PATCH` it with the `updatedAt` they read. When the owner
 * changed the note in the app in between, the server answers 409 and the command exits 7 without
 * retrying, so the browser's text is never overwritten. They send markdown only: the server then
 * drops the note's TipTap JSON so the editor reloads from the new markdown.
 *
 * Delete keeps a local copy in `trash/<id>.md` (lib/trash.mjs) first; restore recreates the note
 * from it under a new id (ids carry the creation date).
 */

import { ApiError } from '../lib/api.mjs';
import { UsageError } from '../lib/args.mjs';
import { confirmRemoval } from '../lib/confirm.mjs';
import { ReferenceError_, resolveContract } from '../lib/resolve.mjs';
import { appendedContent, countWords, editedContent, headingTitle, readBody } from '../lib/note-body.mjs';
import { listTrash, readTrash, removeTrash, trashPath, writeTrash } from '../lib/trash.mjs';
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

async function fetchNote(api, noteId) {
	return (await api.get(notePath(noteId))).note;
}

async function patchNote(api, note, changes) {
	try {
		return (await api.patch(notePath(note.id), { ...changes, expectedUpdatedAt: note.updatedAt })).note;
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
		print(`Note ${note.id} is already there; nothing changed.`, note);
		return;
	}
	const updated = await patchNote(api, note, changes);
	print(`Updated note ${updated.id}: ${updated.title ?? '(untitled)'}${movedTo}`, updated);
}

export async function noteAppend({ api, print, positionals, flags, stdin = process.stdin }) {
	const noteId = positionals[0];
	const text = readBody(flags, stdin).trim();
	if (!noteId || !text) throw new UsageError('Usage: chronolog note append <note-id> [--file text.md]  (or pipe the text on stdin)');
	const note = await fetchNote(api, noteId);
	const updated = await patchNote(api, note, { content: appendedContent(note.content, text) });
	print(`Appended ${countWords(text)} words to note ${updated.id}: ${updated.title ?? '(untitled)'}`, updated);
}

export async function noteDelete({ api, print, positionals, flags, environment = process.env, stdin = process.stdin, stdout = process.stderr }) {
	const noteId = positionals[0];
	if (!noteId) throw new UsageError('Usage: chronolog note delete <note-id> [--yes]');
	const path = trashPath(noteId, environment);
	const note = await fetchNote(api, noteId);
	const contract = await contractLabel(api, note.contractId);
	const words = countWords(note.content);
	await confirmRemoval({
		flags,
		summary: `Note ${note.id} “${note.title ?? '(untitled)'}” in ${contract}, ${words} words.`,
		question: 'Delete it?',
		refusal: 'Not deleted: confirm with the owner, then run again with --yes.',
		stdin,
		stdout
	});

	writeTrash({ ...note, contract, deletedAt: new Date().toISOString() }, environment);
	let deleted;
	try {
		deleted = await api.delete(notePath(note.id));
	} catch (failure) {
		removeTrash(note.id, environment);
		throw failure;
	}
	print(
		`Deleted note ${note.id} “${note.title ?? '(untitled)'}” from ${contract}.\nA copy is in ${path}\n(\`chronolog note restore ${note.id}\` brings it back as a new note.)`,
		{ deleted: { id: deleted.id, title: deleted.title, contractId: deleted.contractId }, trashPath: path }
	);
}

export async function noteRestore({ api, print, positionals, flags, environment = process.env }) {
	const noteId = positionals[0];
	if (!noteId) {
		const trashed = listTrash(environment);
		const lines = trashed.map((record) => `${record.id}  ${record.deletedAt.slice(0, 10)}  ${record.contract}  ${record.title}`);
		const withoutBodies = trashed.map((record) => Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'content')));
		print([`Deleted notes that can be restored: ${trashed.length}`, ...lines].join('\n'), withoutBodies);
		return;
	}
	const record = readTrash(noteId, environment);
	if (!record) throw new ReferenceError_(`No deleted copy of ${noteId} in ${trashPath(noteId, environment)}.`);

	let contractId = record.contractId;
	let label = record.contract;
	if (flags.contract) {
		const contract = resolveContract(flags.contract, await fetchContracts(api));
		contractId = contract.id;
		label = `${contract.clientShortCode}/${contract.name}`;
	}
	const { note } = await api.post('/api/notes', { contractId, title: record.title || headingTitle(record.content) || '', content: record.content });
	removeTrash(noteId, environment);
	print(`Restored ${noteId} as new note ${note.id} in ${label}: ${note.title ?? '(untitled)'}`, { ...note, restoredFrom: noteId });
}
