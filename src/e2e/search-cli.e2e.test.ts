/**
 * Sprint 042-CL: `chronolog search` against the live server. A note (title hit), a second note
 * (body hit) and an entry share a word; the CLI prints the Notes and Time entries groups with
 * marked snippets, `--json` passes GET /api/search through, a trashed note drops out, and a
 * one-character query is a usage error.
 */
import './test-init';
import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL, authGet, authPost } from './helpers';

const CLI_PATH = join(import.meta.dirname, '..', '..', 'cli', 'chronolog.mjs');
const CONFIG_PATH = join(mkdtempSync(join(tmpdir(), 'chronolog-cli-042-')), 'config.json');
const WORD = `numbat${Date.now().toString(36)}`;

let rawToken = '';
let contractId = '';

function runCli(args: string[], stdinText = ''): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		const child = execFile(
			process.execPath,
			[CLI_PATH, ...args],
			{ env: { ...process.env, CHRONOLOG_CONFIG: CONFIG_PATH, CHRONOLOG_BASE_URL: BASE_URL, CHRONOLOG_API_TOKEN: rawToken } },
			(error, stdout, stderr) => resolve({ exitCode: error ? Number(error.code ?? 1) : 0, stdout, stderr })
		);
		child.stdin?.end(stdinText);
	});
}

async function runJson(args: string[], stdinText = '') {
	const result = await runCli([...args, '--json'], stdinText);
	expect(result.exitCode, result.stderr).toBe(0);
	return JSON.parse(result.stdout);
}

beforeAll(async () => {
	const tokenResponse = await authPost('/api/tokens', { name: 'e2e 042 laptop' });
	expect(tokenResponse.status).toBe(201);
	rawToken = (await tokenResponse.json()).rawToken;
	const response = await authGet('/api/contracts-by-client');
	contractId = (await response.json()).contracts[0].id;
});

describe('chronolog search', () => {
	let titleNote = '';
	let bodyNote = '';

	it('prints notes (title hits first) and time entries, with marked snippets', async () => {
		bodyNote = (await runJson(['note', 'new', contractId, 'Weekly review'], `We discussed the ${WORD} plan.\n`)).id;
		titleNote = (await runJson(['note', 'new', contractId, `The ${WORD} brief`], 'Short body\n')).id;
		await runJson(['log', contractId, '30m', `Drafted the ${WORD} brief`, '--date', '2026-11-02']);

		const result = await runCli(['search', WORD]);
		expect(result.exitCode, result.stderr).toBe(0);
		const lines = result.stdout.split('\n');
		expect(lines[0]).toBe('Notes (2)');
		expect(lines[1]).toContain(titleNote);
		expect(lines[1]).toContain(`The ${WORD} brief`);
		expect(result.stdout).toContain(bodyNote);
		expect(result.stdout).toContain(`We discussed the »${WORD}« plan.`);
		expect(result.stdout).toContain('Time entries (1)');
		expect(result.stdout).toMatch(new RegExp(`2026-11-02 +30m .*Drafted the »${WORD}« brief`));
	});

	it('--json returns the grouped API result; a trashed note drops out', async () => {
		const json = await runJson(['search', WORD]);
		expect(json.notes.hits.map((hit: { id: string }) => hit.id)).toEqual([titleNote, bodyNote]);
		expect(json.timeEntries.total).toBe(1);
		expect(json.timeEntries.hits[0].snippet.matches).toHaveLength(1);

		const deleted = await runCli(['note', 'delete', bodyNote, '--yes']);
		expect(deleted.exitCode, deleted.stderr).toBe(0);
		const after = await runJson(['search', WORD, '--limit', '5']);
		expect(after.notes.hits.map((hit: { id: string }) => hit.id)).toEqual([titleNote]);
	});

	it('refuses a one-character query (exit 2)', async () => {
		const result = await runCli(['search', 'x']);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain('at least 2 characters');
	});
});
