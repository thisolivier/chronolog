/**
 * Sprint 039-CL: pinned notes and the client order through the `chronolog` CLI against the live
 * server. `note pin` puts an older note on top of `notes` with a pin marker (the browser's list
 * order), keeps its `updatedAt`, and `note unpin` puts it back; `GET /api/notes?clientId=` lists the
 * client's contracts together (`?all=true` every note, sprint 051-UI); `client edit --order` moves a client in the order the sidebar uses
 * (`/api/clients` and `clientSortOrder` in `/api/contracts-by-client`).
 */
import './test-init';
import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL, authGet, authPost } from './helpers';

const CLI_PATH = join(import.meta.dirname, '..', '..', 'cli', 'chronolog.mjs');
const CONFIG_PATH = join(mkdtempSync(join(tmpdir(), 'chronolog-cli-039-')), 'config.json');
const PIN_MARKER = '📌';

let rawToken = '';

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

async function getJson(path: string) {
	const response = await authGet(path);
	expect(response.status, path).toBe(200);
	return response.json();
}

const unique = `${Date.now().toString(36)}`.toUpperCase().slice(-5);

beforeAll(async () => {
	const tokenResponse = await authPost('/api/tokens', { name: 'e2e 039 laptop' });
	expect(tokenResponse.status).toBe(201);
	rawToken = (await tokenResponse.json()).rawToken;
});

describe('note pin / unpin through the CLI', () => {
	let clientId = '';
	let firstContractId = '';
	let secondContractId = '';
	const noteIds: string[] = [];

	it('pins an older note to the top of `notes` with a marker, keeping updatedAt', async () => {
		const client = await runJson(['client', 'add', `Pins ${unique}`, '--code', `P${unique}`]);
		clientId = client.id;
		firstContractId = (await runJson(['contract', 'add', `P${unique}`, 'Pinned work'])).id;
		secondContractId = (await runJson(['contract', 'add', `P${unique}`, 'Other work'])).id;
		for (const title of ['Oldest', 'Middle', 'Newest']) {
			noteIds.push((await runJson(['note', 'new', firstContractId, title], `${title} body\n`)).id);
		}
		const [oldest, middle, newest] = noteIds;
		const before = await getJson(`/api/notes/${oldest}`);

		const pinned = await runJson(['note', 'pin', oldest]);
		expect(pinned).toMatchObject({ id: oldest, isPinned: true });
		const listed = await runCli(['notes', `P${unique}/Pinned work`]);
		expect(listed.exitCode, listed.stderr).toBe(0);
		const lines = listed.stdout.trim().split('\n').slice(1);
		expect(lines[0].startsWith(`${PIN_MARKER} ${oldest}`)).toBe(true);
		expect(lines.slice(1).map((line) => line.split(' ')[0])).toEqual([newest, middle]);
		expect((await getJson(`/api/notes/${oldest}`)).note.updatedAt).toBe(before.note.updatedAt);

		const unpinned = await runJson(['note', 'unpin', oldest]);
		expect(unpinned.isPinned).toBe(false);
		const relisted = (await runJson(['notes', `P${unique}/Pinned work`])).map((note: { id: string }) => note.id);
		expect(relisted).toEqual([newest, middle, oldest]);
	});

	it('an unknown or trashed note exits 3', async () => {
		expect((await runCli(['note', 'pin', `NOPE.${unique}.001`])).exitCode).toBe(3);
		const trashed = (await runJson(['note', 'new', firstContractId, 'Soon gone'], 'x\n')).id;
		await runJson(['note', 'delete', trashed, '--yes']);
		const result = await runCli(['note', 'pin', trashed]);
		expect(result.exitCode).toBe(3);
		expect(result.stderr).toContain('trash');
	});

	it('GET /api/notes?clientId= lists every contract of the client, pinned first', async () => {
		const elsewhere = (await runJson(['note', 'new', secondContractId, 'In the other contract'], 'y\n')).id;
		await runJson(['note', 'pin', noteIds[1]]);
		const { notes } = await getJson(`/api/notes?clientId=${clientId}`);
		const ids = notes.map((note: { id: string }) => note.id);
		expect(ids[0]).toBe(noteIds[1]);
		expect(ids).toContain(elsewhere);
		expect(new Set(notes.map((note: { contractId: string }) => note.contractId))).toEqual(new Set([firstContractId, secondContractId]));
	});

	it('GET /api/notes?all=true lists every note, newest change first, pins not floated (sprint 051-UI)', async () => {
		const { notes } = await getJson('/api/notes?all=true');
		const updatedTimes = notes.map((note: { updatedAt: string }) => new Date(note.updatedAt).getTime());
		expect(updatedTimes).toEqual([...updatedTimes].sort((left, right) => right - left));
		const ids = notes.map((note: { id: string }) => note.id);
		expect(ids).toEqual(expect.arrayContaining(noteIds));
		// noteIds[1] is pinned but older than the note made in the other contract
		expect(notes.find((note: { id: string }) => note.id === noteIds[1]).isPinned).toBe(true);
		expect(ids.indexOf(noteIds[1])).toBeGreaterThan(ids.indexOf(noteIds[2]));
		// Still an explicit opt-in: no filter is 400, and all=true does not mix with a filter
		expect((await authGet('/api/notes')).status).toBe(400);
		expect((await authGet(`/api/notes?all=true&clientId=${clientId}`)).status).toBe(400);
	});
});

describe('client edit --order through the CLI', () => {
	it('moves a client to the top and to the bottom of the sidebar order', async () => {
		const code = `O${unique}`;
		const moved = await runJson(['client', 'add', `Order ${unique}`, '--code', code]);
		const top = await runJson(['client', 'edit', code, '--order', '1']);
		expect(top.position).toBe(1);
		let { clients } = await getJson('/api/clients');
		expect(clients[0].id).toBe(moved.id);
		const { contracts } = await getJson('/api/contracts-by-client');
		expect(contracts.every((contract: { clientSortOrder: number }) => Number.isInteger(contract.clientSortOrder))).toBe(true);

		const human = await runCli(['client', 'edit', code, '--order', '999']);
		expect(human.exitCode, human.stderr).toBe(0);
		expect(human.stdout).toMatch(/number \d+ in the sidebar/);
		({ clients } = await getJson('/api/clients'));
		expect(clients.at(-1).id).toBe(moved.id);

		expect((await runCli(['client', 'edit', code, '--order', '0'])).exitCode).toBe(2);
	});
});
