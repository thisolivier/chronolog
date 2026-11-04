/**
 * Sprint 029-CL: JSON body guards over HTTP, note IDs under eight parallel creates, and the
 * CLI's `edit` and `undo` run as a child process against the live server.
 */
import './test-init';
import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL, authGet, authPost, getSessionCookies } from './helpers';

const CLI_PATH = join(import.meta.dirname, '..', '..', 'cli', 'chronolog.mjs');
const CONFIG_PATH = join(mkdtempSync(join(tmpdir(), 'chronolog-cli-029-')), 'config.json');

let rawToken = '';
let generalContractId = '';

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

function rawPost(path: string, rawBody: string, extraHeaders: Record<string, string> = {}): Promise<Response> {
	return fetch(`${BASE_URL}${path}`, {
		method: 'POST',
		headers: { Cookie: getSessionCookies().join('; '), 'Content-Type': 'application/json', ...extraHeaders },
		body: rawBody,
		redirect: 'manual'
	});
}

beforeAll(async () => {
	const tokenResponse = await authPost('/api/tokens', { name: 'e2e 029 laptop' });
	expect(tokenResponse.status).toBe(201);
	rawToken = (await tokenResponse.json()).rawToken;

	const contracts = await (await authGet('/api/contracts')).json();
	generalContractId = contracts.find((contract: { name: string }) => contract.name === 'General').id;
});

describe('JSON body guards over HTTP', () => {
	it.each(['/api/timer/start', '/api/timer/save', '/api/timer/discard', '/api/notes', '/api/time-entries/weekly-statuses', '/api/time-entries'])(
		'POST %s with a broken body is 400 invalid_json',
		async (path) => {
			const response = await rawPost(path, '{"oops"');
			expect(response.status).toBe(400);
			expect(await response.json()).toMatchObject({ code: 'invalid_json', error: 'Invalid JSON body' });
		}
	);
});

describe('note IDs', () => {
	it('eight parallel creates all succeed with distinct consecutive IDs', async () => {
		const responses = await Promise.all(
			Array.from({ length: 8 }, (_, index) =>
				rawPost('/api/notes', JSON.stringify({ contractId: generalContractId, title: `Parallel ${index}` }))
			)
		);
		expect(responses.map((response) => response.status)).toEqual(Array(8).fill(201));
		const ids = (await Promise.all(responses.map((response) => response.json()))).map((body) => body.note.id as string);
		expect(new Set(ids).size).toBe(8);
		const sequences = ids.map((id) => Number(id.split('.')[2])).sort((left, right) => left - right);
		expect(sequences[7] - sequences[0]).toBe(7);
	});

	it('dates the ID in the caller timezone (X-Timezone)', async () => {
		const zone = 'Pacific/Kiritimati'; // UTC+14: usually a different calendar day from UTC
		const expectedDate = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
			.format(new Date())
			.replace(/-/g, '');
		const response = await rawPost('/api/notes', JSON.stringify({ contractId: generalContractId }), { 'X-Timezone': zone });
		expect(response.status).toBe(201);
		expect((await response.json()).note.id.split('.')[1]).toBe(expectedDate);
	});
});

describe('chronolog edit and undo', () => {
	it('undo refuses when this CLI has logged nothing', async () => {
		const result = await runCli(['undo', '--json']);
		expect(result.exitCode).toBe(2);
		expect(JSON.parse(result.stderr).error).toContain('Nothing to undo');
	});

	it('edits a logged entry, then undo deletes it once', async () => {
		const logged = await runCli(['log', 'internal general', '45m', 'First draft', '--date', '2026-02-10', '--json']);
		expect(logged.exitCode).toBe(0);
		const entryId = JSON.parse(logged.stdout).id;

		const edited = await runCli(['edit', entryId, '--duration', '9:00-11:00', '--description', 'Reviewed the draft', '--date', '2026-02-11', '--json']);
		expect(edited.exitCode).toBe(0);
		expect(JSON.parse(edited.stdout)).toMatchObject({
			id: entryId,
			durationMinutes: 120,
			startTime: '09:00:00',
			endTime: '11:00:00',
			description: 'Reviewed the draft',
			date: '2026-02-11'
		});

		const plain = await runCli(['edit', entryId, '--duration', '1h30m', '--json']);
		expect(JSON.parse(plain.stdout)).toMatchObject({ durationMinutes: 90, startTime: null, endTime: null });

		const range = await (await authGet('/api/time-entries?from=2026-02-09&to=2026-02-15')).json();
		expect(range.entries.find((entry: { id: string }) => entry.id === entryId)).toMatchObject({ durationMinutes: 90 });

		const undone = await runCli(['undo']);
		expect(undone.exitCode).toBe(0);
		expect(undone.stdout).toContain('Deleted');
		expect((await authGet(`/api/time-entries/${entryId}`)).status).toBe(404);

		expect((await runCli(['undo'])).exitCode).toBe(2);
	});

	it('edit rejects a bad duration (exit 1) and an unknown entry (404)', async () => {
		const logged = await runCli(['log', 'internal general', '30m', 'To fix', '--date', '2026-02-12', '--json']);
		const entryId = JSON.parse(logged.stdout).id;
		const badDuration = await runCli(['edit', entryId, '--duration', 'soon', '--json']);
		expect(badDuration.exitCode).toBe(1);
		expect(JSON.parse(badDuration.stderr)).toMatchObject({ code: 'invalid_duration', status: 400 });

		const unknown = await runCli(['edit', '00000000-0000-4000-8000-000000000000', '--description', 'x', '--json']);
		expect(JSON.parse(unknown.stderr)).toMatchObject({ status: 404 });
	});
});
