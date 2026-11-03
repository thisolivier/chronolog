/**
 * Sprint 028-CL: personal API tokens, the JSON error shape, and the `chronolog` CLI run
 * as a child process against the live server with a bearer token.
 */
import './test-init';
import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL, authGet, authPost, authDelete } from './helpers';

const CLI_PATH = join(import.meta.dirname, '..', '..', 'cli', 'chronolog.mjs');
const CONFIG_PATH = join(mkdtempSync(join(tmpdir(), 'chronolog-cli-')), 'config.json');

let rawToken = '';
let tokenId = '';

function bearerGet(path: string, token = rawToken): Promise<Response> {
	return fetch(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

function runCli(args: string[], stdin?: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		const child = execFile(
			process.execPath,
			[CLI_PATH, ...args],
			{
				env: { ...process.env, CHRONOLOG_CONFIG: CONFIG_PATH, CHRONOLOG_BASE_URL: BASE_URL, CHRONOLOG_API_TOKEN: rawToken }
			},
			(error, stdout, stderr) => resolve({ exitCode: error ? Number(error.code ?? 1) : 0, stdout, stderr })
		);
		child.stdin?.end(stdin ?? '');
	});
}

beforeAll(async () => {
	const response = await authPost('/api/tokens', { name: 'e2e laptop' });
	expect(response.status).toBe(201);
	const body = await response.json();
	rawToken = body.rawToken;
	tokenId = body.token.id;
	expect(rawToken).toMatch(/^clg_/);
});

describe('API tokens', () => {
	it('lists the token without its secret or hash', async () => {
		const body = await (await authGet('/api/tokens')).json();
		const listed = body.tokens.find((token: { id: string }) => token.id === tokenId);
		expect(listed.name).toBe('e2e laptop');
		expect(JSON.stringify(body)).not.toContain(rawToken.slice(-20));
		expect(listed.tokenHash).toBeUndefined();
	});

	it('authenticates /api/me with the bearer token', async () => {
		const response = await bearerGet('/api/me?tz=Europe/London');
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.authenticatedBy).toBe('token');
		expect(body.timezone).toBe('Europe/London');
		expect(body.isoWeek).toMatch(/^\d{4}-W\d{2}$/);
	});

	it('refuses token management with a bearer token', async () => {
		const response = await bearerGet('/api/tokens');
		expect(response.status).toBe(403);
		expect((await response.json()).code).toBe('session_required');
	});

	it('answers errors as { error, code } JSON', async () => {
		const missing = await fetch(`${BASE_URL}/api/clients`, { headers: { Accept: 'text/html' } });
		expect(missing.status).toBe(401);
		expect(await missing.json()).toMatchObject({ code: 'unauthorized' });

		const notFound = await bearerGet('/api/notes/NOPE.20260101.001');
		expect(notFound.status).toBe(404);
		expect(await notFound.json()).toMatchObject({ error: 'Note not found', code: 'not_found' });
	});

	it('lists time entries by date range', async () => {
		const response = await bearerGet('/api/time-entries?from=2026-01-01&to=2026-01-31');
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ from: '2026-01-01', to: '2026-01-31', entries: [] });
		expect((await bearerGet('/api/time-entries?from=2026-02-01&to=2026-01-01')).status).toBe(400);
	});
});

describe('chronolog CLI against the API', () => {
	let noteId = '';

	it('lists clients and contracts', async () => {
		const clients = await runCli(['clients', '--json']);
		expect(clients.exitCode).toBe(0);
		expect(JSON.parse(clients.stdout).some((client: { name: string }) => client.name === 'Internal')).toBe(true);

		const contracts = await runCli(['contracts', 'internal']);
		expect(contracts.stdout).toContain('/General');
	});

	it('creates a note from stdin and shows it', async () => {
		const created = await runCli(['note', 'new', 'internal general', 'CLI status note', '--json'], 'Shipped the CLI.\n');
		expect(created.exitCode).toBe(0);
		noteId = JSON.parse(created.stdout).id;

		const shown = await runCli(['note', 'show', noteId]);
		expect(shown.stdout).toContain('# CLI status note');
		expect(shown.stdout).toContain('Shipped the CLI.');

		const listed = await runCli(['notes', 'internal general', '--json']);
		const listedNote = JSON.parse(listed.stdout).find((note: { id: string }) => note.id === noteId);
		expect(listedNote.firstLine).toBe('CLI status note');
	});

	it('logs time with a duration string and a note reference, linking the note', async () => {
		const logged = await runCli(['log', 'internal general', '9:00-10:30', 'Pairing on the CLI', '--date', '2026-01-14', '--note', noteId, '--json']);
		expect(logged.exitCode).toBe(0);
		const entry = JSON.parse(logged.stdout);
		expect(entry.durationMinutes).toBe(90);
		expect(entry.startTime).toBe('09:00:00');
		expect(entry.description).toContain(`[[${noteId}]]`);

		const links = await (await bearerGet(`/api/notes/${noteId}/time-entries`)).json();
		expect(links.timeEntries.some((linked: { timeEntryId: string }) => linked.timeEntryId === entry.id)).toBe(true);

		const week = await runCli(['week', '2026-W03', '--json']);
		expect(JSON.parse(week.stdout).entries.some((weekEntry: { id: string }) => weekEntry.id === entry.id)).toBe(true);
	});

	it('refuses to guess: unknown contract and unknown note exit 3', async () => {
		expect((await runCli(['log', 'no such client', '1h', 'x'])).exitCode).toBe(3);
		expect((await runCli(['log', 'internal general', '1h', 'x', '--note', 'NOPE.20260101.001'])).exitCode).toBe(3);
		expect((await runCli(['log', 'internal general', 'soon', 'x'])).exitCode).toBe(1);
	});

	it('sets a week status', async () => {
		const result = await runCli(['status', '2026-W03', 'draft-ready']);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('Draft ready');
	});

	it('gets 403 (exit 4) after the token is revoked', async () => {
		expect((await authDelete(`/api/tokens/${tokenId}`)).status).toBe(200);
		const response = await bearerGet('/api/me');
		expect(response.status).toBe(403);
		expect((await response.json()).code).toBe('token_revoked');

		const result = await runCli(['clients', '--json']);
		expect(result.exitCode).toBe(4);
		expect(JSON.parse(result.stderr)).toMatchObject({ code: 'token_revoked', status: 403 });
	});
});
