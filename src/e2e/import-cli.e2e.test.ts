/**
 * Sprint 038-CL: `chronolog import` against the live server (the CLI as a child process). A dry
 * run sends nothing; 30 notes (12 backdated, one append to an existing note by id) and 60 entries
 * (a JSON array) are imported from the fixture files; `week` shows the entries; a file with an
 * unknown reference is refused whole (exit 3); `undo --last-import --yes` deletes the entries.
 */
import './test-init';
import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL, authGet, authPost } from './helpers';

const CLI_PATH = join(import.meta.dirname, '..', '..', 'cli', 'chronolog.mjs');
const WORK_DIRECTORY = mkdtempSync(join(tmpdir(), 'chronolog-cli-038-'));
const CONFIG_PATH = join(WORK_DIRECTORY, 'config.json');
const SHORT_CODE = `I${Date.now().toString(36).slice(-5).toUpperCase()}`;
const WEEK = '2026-W40';

let rawToken = '';
let existingNoteId = '';
let notesFile = '';
let entriesFile = '';

function runCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		const child = execFile(
			process.execPath,
			[CLI_PATH, ...args],
			{ env: { ...process.env, CHRONOLOG_CONFIG: CONFIG_PATH, CHRONOLOG_BASE_URL: BASE_URL, CHRONOLOG_API_TOKEN: rawToken } },
			(error, stdout, stderr) => resolve({ exitCode: error ? Number(error.code ?? 1) : 0, stdout, stderr })
		);
		child.stdin?.end('');
	});
}

async function runJson(args: string[]) {
	const result = await runCli([...args, '--json']);
	expect(result.exitCode, result.stderr).toBe(0);
	return JSON.parse(result.stdout);
}

function fixture(name: string, replacements: Record<string, string>): string {
	let text = readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');
	for (const [placeholder, value] of Object.entries(replacements)) text = text.replaceAll(placeholder, value);
	const path = join(WORK_DIRECTORY, name);
	writeFileSync(path, text);
	return path;
}

async function weekEntries() {
	return (await runJson(['week', WEEK, '--client', SHORT_CODE])).entries as Array<{ id: string; description: string; durationMinutes: number }>;
}

beforeAll(async () => {
	const tokenResponse = await authPost('/api/tokens', { name: 'e2e 038 laptop' });
	expect(tokenResponse.status).toBe(201);
	rawToken = (await tokenResponse.json()).rawToken;

	await runJson(['client', 'add', 'Import Co', '--code', SHORT_CODE]);
	await runJson(['contract', 'add', SHORT_CODE, 'Research']);
	await runJson(['contract', 'add', SHORT_CODE, 'Support']);
	await runJson(['deliverable', 'add', `${SHORT_CODE}/Research`, 'Discovery']);
	await runJson(['work-type', 'add', `${SHORT_CODE}/Research/Discovery`, 'Interviews']);
	existingNoteId = (await runJson(['note', 'new', `${SHORT_CODE}/Research`, 'Running log', '--date', '2026-09-01'])).id;

	notesFile = fixture('import-notes.jsonl', { CODE: SHORT_CODE, __NOTE_ID__: existingNoteId });
	entriesFile = fixture('import-entries.json', { CODE: SHORT_CODE });
});

describe('chronolog import notes', () => {
	it('--dry-run resolves everything and sends nothing', async () => {
		const result = await runJson(['import', 'notes', notesFile, '--dry-run']);
		expect(result).toMatchObject({ dryRun: true, requests: 1 });
		expect(result.items).toHaveLength(30);
		const listed = await (await authGet(`/api/notes?updatedSince=2000-01-01T00:00:00Z`)).json();
		expect(listed.notes.filter((note: { title: string }) => note.title?.startsWith('Imported note'))).toHaveLength(0);
	});

	it('imports 29 new notes (12 backdated) and appends to the existing one', async () => {
		const result = await runCli(['import', 'notes', notesFile]);
		expect(result.exitCode, result.stderr).toBe(0);
		const lines = result.stdout.trim().split('\n');
		expect(lines.filter((line) => line.startsWith('ok '))).toHaveLength(30);
		expect(lines.at(-1)).toBe('Imported 30 of 30 notes from import-notes.jsonl: 29 created, 1 updated, 0 failed.');
		expect(result.stdout).toContain(`ok 3 ${SHORT_CODE}.20260928.001`);
		expect(result.stdout).toContain(`ok 32 ${existingNoteId} (updated, unconditionally)`);

		const backdated = lines.filter((line) => /\.202609(28|29|30)\.|\.2026100[1-3]\./.test(line));
		expect(backdated).toHaveLength(12);

		const existing = (await (await authGet(`/api/notes/${existingNoteId}`)).json()).note;
		expect(existing.content).toBe('# Running log\n\nAdded by the import.\n');
		const created = (await (await authGet(`/api/notes/${SHORT_CODE}.20260928.001`)).json()).note;
		expect(created.content).toBe('# Imported note 01\n\nBack-filled history, item 1.\n\n- point one\n- point two\n');
	});

	it('undo --last-import needs --yes, then moves the 29 created notes to the trash (044-CL)', async () => {
		const refused = await runCli(['undo', '--last-import']);
		expect(refused.exitCode).toBe(2);
		expect((await authGet(`/api/notes/${SHORT_CODE}.20260928.001`)).status).toBe(200);

		const result = await runJson(['undo', '--last-import', '--yes']);
		expect(result).toMatchObject({ trashed: 29, alreadyGone: 0 });
		expect(result.noteIds).toHaveLength(29);
		expect((await authGet(`/api/notes/${SHORT_CODE}.20260928.001`)).status).toBe(404);
		const trash = await runJson(['note', 'restore']);
		const trashedIds = JSON.stringify(trash);
		for (const noteId of result.noteIds) expect(trashedIds).toContain(noteId);

		// The updated note is not undone; the record is cleared
		expect((await (await authGet(`/api/notes/${existingNoteId}`)).json()).note.content).toBe('# Running log\n\nAdded by the import.\n');
		expect((await runCli(['undo', '--last-import', '--yes'])).exitCode).toBe(2);
	});
});

describe('chronolog import entries', () => {
	it('refuses a file with an unknown reference before sending anything (exit 3)', async () => {
		const badFile = join(WORK_DIRECTORY, 'bad.jsonl');
		writeFileSync(
			badFile,
			[
				JSON.stringify({ contract: `${SHORT_CODE}/Research`, date: '2026-09-28', duration: '1h' }),
				JSON.stringify({ contract: `${SHORT_CODE}/Nowhere`, date: '2026-09-28', duration: '1h' })
			].join('\n')
		);
		const result = await runCli(['import', 'entries', badFile]);
		expect(result.exitCode).toBe(3);
		expect(result.stderr).toContain('line 2: No contract matches');
		expect(await weekEntries()).toHaveLength(0);
	});

	it('imports 60 entries, which week then shows', async () => {
		const result = await runJson(['import', 'entries', entriesFile]);
		expect(result).toMatchObject({ created: 60, updated: 0, failed: 0 });
		const entries = await weekEntries();
		expect(entries).toHaveLength(60);
		expect(entries.map((entry) => entry.id).sort()).toEqual(result.results.map((item: { id: string }) => item.id).sort());
		const range = entries.find((entry) => entry.description === 'Imported entry 06 (a range)');
		expect(range?.durationMinutes).toBe(90);

		const humanWeek = await runCli(['week', WEEK, '--client', SHORT_CODE]);
		expect(humanWeek.stdout).toContain('Imported entry 01');
	});

	it('undo --last-import needs --yes, then deletes every imported entry', async () => {
		const refused = await runCli(['undo', '--last-import']);
		expect(refused.exitCode).toBe(2);
		expect(await weekEntries()).toHaveLength(60);

		const result = await runCli(['undo', '--last-import', '--yes']);
		expect(result.exitCode, result.stderr).toBe(0);
		expect(result.stdout.trim()).toBe('Deleted 60 time entries from the import of import-entries.json.');
		expect(await weekEntries()).toHaveLength(0);
	});
});
