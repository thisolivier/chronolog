/**
 * Local copies of deleted notes (sprint 034-CL): `note delete` writes the note's markdown to
 * `trash/<id>.md` next to the config file (`~/.config/chronolog/trash/`, directory 700, file 600)
 * before deleting it on the server; `note restore` reads it back and removes it.
 *
 * File format: a `---` header of `key: value` lines (id, title, contractId, contract, updatedAt,
 * deletedAt), a blank line, then the note's markdown exactly as it was.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { configPath } from './config.mjs';
import { UsageError } from './args.mjs';

const HEADER_KEYS = ['id', 'title', 'contractId', 'contract', 'updatedAt', 'deletedAt'];

export function trashDirectory(environment = process.env) {
	return join(dirname(configPath(environment)), 'trash');
}

export function trashPath(noteId, environment = process.env) {
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(noteId) || noteId.includes('..')) {
		throw new UsageError(`“${noteId}” is not a note id (they look like ACME.20261104.001).`);
	}
	return join(trashDirectory(environment), `${noteId}.md`);
}

export function writeTrash(record, environment = process.env) {
	const path = trashPath(record.id, environment);
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	const header = HEADER_KEYS.map((key) => `${key}: ${String(record[key] ?? '').replace(/\s*\n\s*/g, ' ')}`);
	writeFileSync(path, ['---', ...header, '---', '', record.content ?? ''].join('\n'), { mode: 0o600 });
	return path;
}

/** The trashed note, or null when there is no file for that id. */
export function readTrash(noteId, environment = process.env) {
	const path = trashPath(noteId, environment);
	if (!existsSync(path)) return null;
	const text = readFileSync(path, 'utf8');
	const lines = text.split('\n');
	const closing = lines.indexOf('---', 1);
	if (lines[0] !== '---' || closing < 0) throw new Error(`${path} has no header; restore it by hand with \`chronolog note new\`.`);
	const record = { path };
	for (const line of lines.slice(1, closing)) {
		const separator = line.indexOf(': ');
		const key = separator < 0 ? line.replace(/:$/, '') : line.slice(0, separator);
		record[key] = separator < 0 ? '' : line.slice(separator + 2);
	}
	record.content = lines.slice(closing + 2).join('\n');
	return record;
}

export function listTrash(environment = process.env) {
	const directory = trashDirectory(environment);
	if (!existsSync(directory)) return [];
	return readdirSync(directory)
		.filter((name) => name.endsWith('.md'))
		.map((name) => readTrash(name.slice(0, -3), environment))
		.filter(Boolean);
}

export function removeTrash(noteId, environment = process.env) {
	rmSync(trashPath(noteId, environment), { force: true });
}
