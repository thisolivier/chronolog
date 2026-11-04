/**
 * Attachments from the CLI (sprint 036-CL): note attach, note attachments, attachment get,
 * attachment delete.
 *
 * `note attach` uploads the file (multipart, Node's own FormData and Blob), then appends the
 * reference line to the note through the 034 append path: it reads the note first and `PATCH`es
 * with that `updatedAt` (or `--expected-updated-at`), so an edit made in the app meanwhile exits 7
 * and nothing is overwritten (the file stays attached; the message carries the line to add).
 * `attachment delete` is confirmed like `note delete` (031 rule) and only warns about links to it.
 */

import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { ApiError } from '../lib/api.mjs';
import { UsageError } from '../lib/args.mjs';
import { confirmRemoval } from '../lib/confirm.mjs';
import { ReferenceError_ } from '../lib/resolve.mjs';
import { appendedContent } from '../lib/note-body.mjs';
import { countReferences, filenameFromDisposition, formatSize, mimeTypeForFile, referenceLine } from '../lib/attachment-files.mjs';
import { NoteChanged, fetchNote, patchNote } from './note-changes.mjs';

const attachmentPath = (attachmentId) => `/api/attachments/${encodeURIComponent(attachmentId)}`;
const noteAttachmentsPath = (noteId) => `/api/notes/${encodeURIComponent(noteId)}/attachments`;

/** A 404 for an attachment is an unknown reference (exit 3), like an unknown note. */
async function withAttachmentLookup(attachmentId, call) {
	try {
		return await call();
	} catch (failure) {
		if (failure instanceof ApiError && failure.status === 404) throw new ReferenceError_(`No attachment ${attachmentId}.`);
		throw failure;
	}
}

function readUploadFile(filePath) {
	let stats;
	try {
		stats = statSync(filePath);
	} catch {
		throw new UsageError(`No such file: ${filePath}`);
	}
	if (!stats.isFile()) throw new UsageError(`Not a file: ${filePath}`);
	return readFileSync(filePath);
}

export async function noteAttach({ api, print, positionals, flags }) {
	const [noteId, filePath] = positionals;
	if (!noteId || !filePath) throw new UsageError('Usage: chronolog note attach <note-id> <file> [--no-insert] [--expected-updated-at T]');
	const bytes = readUploadFile(filePath);
	const note = await fetchNote(api, noteId);

	const formData = new FormData();
	formData.append('file', new Blob([bytes], { type: mimeTypeForFile(filePath) }), basename(filePath));
	const { attachment } = await api.upload(noteAttachmentsPath(note.id), formData);
	const reference = referenceLine(attachment);
	const described = `${attachment.filename} (${attachment.mimeType}, ${formatSize(attachment.sizeBytes)})`;

	if (flags.noInsert) {
		print(`Attached ${described} to note ${note.id} as ${attachment.id}\nNot added to the text. Reference line:\n${reference}`, { attachment, reference, inserted: false });
		return;
	}
	let updated;
	try {
		updated = await patchNote(api, note, { content: appendedContent(note.content, reference) }, flags);
	} catch (failure) {
		if (failure instanceof NoteChanged) {
			failure.message = `note changed on the server since it was read; ${attachment.filename} is attached as ${attachment.id} but not linked in the text. Re-read the note, then append: ${reference}`;
			failure.attachment = attachment;
		}
		throw failure;
	}
	print(`Attached ${described} to note ${note.id} as ${attachment.id}\nAdded to the end of the note:\n${reference}`, {
		attachment,
		reference,
		inserted: true,
		noteUpdatedAt: updated.updatedAt
	});
}

export async function noteAttachments({ api, print, positionals }) {
	const noteId = positionals[0];
	if (!noteId) throw new UsageError('Usage: chronolog note attachments <note-id>');
	const { attachments } = await api.get(noteAttachmentsPath(noteId));
	const lines = attachments.map(
		(attachment) => `${attachment.id}  ${attachment.filename}  ${attachment.mimeType}  ${formatSize(attachment.sizeBytes)}  ${String(attachment.createdAt).slice(0, 16).replace('T', ' ')}`
	);
	print([`Attachments on ${noteId}: ${attachments.length}`, ...lines].join('\n'), attachments);
}

/** `--out` may name a file or an existing directory; the default is the original name here. */
function outputPath(flags, filename) {
	if (typeof flags.out !== 'string') return resolve(filename);
	try {
		if (statSync(flags.out).isDirectory()) return resolve(join(flags.out, filename));
	} catch {
		// not there yet: a file path
	}
	return resolve(flags.out);
}

export async function attachmentGet({ api, print, positionals, flags }) {
	const attachmentId = positionals[0];
	if (!attachmentId) throw new UsageError('Usage: chronolog attachment get <attachment-id> [--out <path>] [--force]');
	const { bytes, headers } = await withAttachmentLookup(attachmentId, () => api.download(attachmentPath(attachmentId)));
	const filename = filenameFromDisposition(headers.get('content-disposition'), attachmentId);
	const path = outputPath(flags, filename);
	try {
		writeFileSync(path, bytes, { flag: flags.force ? 'w' : 'wx' });
	} catch (failure) {
		if (failure.code === 'EEXIST') throw new UsageError(`${path} already exists; nothing written. Pass --force to overwrite it, or --out <path>.`);
		throw failure;
	}
	const mimeType = headers.get('content-type');
	print(`Saved ${filename} (${mimeType}, ${formatSize(bytes.length)}) to ${path}`, { id: attachmentId, filename, mimeType, sizeBytes: bytes.length, path });
}

export async function attachmentDelete({ api, print, positionals, flags, stdin = process.stdin, stdout = process.stderr }) {
	const attachmentId = positionals[0];
	if (!attachmentId) throw new UsageError('Usage: chronolog attachment delete <attachment-id> [--yes]');
	const headers = await withAttachmentLookup(attachmentId, () => api.head(attachmentPath(attachmentId)));
	const filename = filenameFromDisposition(headers.get('content-disposition'), attachmentId);
	const noteId = headers.get('x-note-id');
	const description = `${filename} (${headers.get('content-type')}, ${formatSize(headers.get('content-length') ?? 0)})`;
	const note = noteId ? await fetchNote(api, noteId) : null;
	const references = note ? countReferences(note.content, attachmentId) : 0;
	const warning = references
		? `Note ${noteId} still links to it (${references} time${references === 1 ? '' : 's'}); the link is left in the text and will show as missing.`
		: '';

	await confirmRemoval({
		flags,
		summary: `Attachment ${attachmentId} ${description} on note ${noteId ?? '?'}${note?.title ? ` “${note.title}”` : ''}.${warning ? `\n${warning}` : ''}`,
		question: 'Delete it?',
		refusal: 'Not deleted: confirm with the owner, then run again with --yes.',
		stdin,
		stdout
	});
	await withAttachmentLookup(attachmentId, () => api.delete(attachmentPath(attachmentId)));
	print(`Deleted attachment ${attachmentId} ${description} from note ${noteId ?? '?'}.${warning ? `\nWarning: ${warning}` : ''}`, {
		deleted: { id: attachmentId, filename, noteId },
		noteStillReferences: references,
		warning: warning || undefined
	});
}
