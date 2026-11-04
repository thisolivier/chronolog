/**
 * Sprint 031-CL: the laptop secretary sets up a client end to end through the `chronolog` CLI
 * (a child process against the live server): client → contract → deliverable → work type, an
 * entry logged against the work type, archive and unarchive, then removal with the entry
 * reassigned to the Deleted Client.
 */
import './test-init';
import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL, authGet, authPost } from './helpers';

const CLI_PATH = join(import.meta.dirname, '..', '..', 'cli', 'chronolog.mjs');
const CONFIG_PATH = join(mkdtempSync(join(tmpdir(), 'chronolog-cli-031-')), 'config.json');
const SHORT_CODE = `Q${Date.now().toString(36).slice(-5).toUpperCase()}`;

let rawToken = '';

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

beforeAll(async () => {
	const tokenResponse = await authPost('/api/tokens', { name: 'e2e 031 laptop' });
	expect(tokenResponse.status).toBe(201);
	rawToken = (await tokenResponse.json()).rawToken;
});

describe('setting up a client through the CLI', () => {
	let clientId = '';
	let contractId = '';
	let deliverableId = '';
	let workTypeId = '';
	let entryId = '';

	it('creates client → contract → deliverable → work type', async () => {
		const client = await runJson(['client', 'add', 'Rocket Works', '--code', SHORT_CODE, '--emoji', '🚀']);
		expect(client).toMatchObject({ name: 'Rocket Works', shortCode: SHORT_CODE, emoji: '🚀', archived: false });
		clientId = client.id;

		const contract = await runJson(['contract', 'add', SHORT_CODE, 'Launch site', '--description', 'Marketing site']);
		expect(contract).toMatchObject({ clientId, name: 'Launch site', description: 'Marketing site', isActive: true });
		contractId = contract.id;

		const deliverable = await runJson(['deliverable', 'add', `${SHORT_CODE}/Launch site`, 'Phase 1']);
		expect(deliverable).toMatchObject({ contractId, name: 'Phase 1' });
		deliverableId = deliverable.id;

		const workType = await runJson(['tag', 'add', `${SHORT_CODE}/Launch site/Phase 1`, 'Design']);
		expect(workType).toMatchObject({ deliverableId, name: 'Design' });
		workTypeId = workType.id;

		expect(await runJson(['work-types', `${SHORT_CODE}/Launch site/Phase 1`])).toEqual([expect.objectContaining({ id: workTypeId })]);
		expect(await runJson(['deliverables', `${SHORT_CODE}/Launch site`])).toEqual([expect.objectContaining({ id: deliverableId })]);
	});

	it('refuses a duplicate short code (exit 5) and an unknown path (exit 3)', async () => {
		const duplicate = await runCli(['client', 'add', 'Copycat', '--code', SHORT_CODE, '--json']);
		expect(duplicate.exitCode).toBe(5);
		expect(JSON.parse(duplicate.stderr)).toMatchObject({ code: 'duplicate', status: 409 });

		const unknown = await runCli(['work-type', 'edit', `${SHORT_CODE}/Launch site/Phase 9/Design`, '--name', 'X', '--json']);
		expect(unknown.exitCode).toBe(3);
	});

	it('logs an entry against the work type', async () => {
		const logged = await runJson(['log', `${SHORT_CODE}/Launch site`, '1h15m', 'Moodboard', '--date', '2026-03-03', '--deliverable', 'Phase 1', '--work-type', 'design']);
		entryId = logged.id;
		const { entry } = await (await authGet(`/api/time-entries/${entryId}`)).json();
		expect(entry).toMatchObject({ contractId, deliverableId, workTypeId, durationMinutes: 75 });
	});

	it('edits, archives and unarchives', async () => {
		expect(await runJson(['work-type', 'edit', `${SHORT_CODE}/Launch site/Phase 1/Design`, '--name', 'Visual design'])).toMatchObject({ name: 'Visual design' });
		expect(await runJson(['contract', 'edit', `${SHORT_CODE}/Launch site`, '--inactive'])).toMatchObject({ isActive: false });

		expect(await runJson(['client', 'archive', SHORT_CODE])).toMatchObject({ archived: true });
		const visible = await runJson(['clients']);
		expect(visible.map((client: { id: string }) => client.id)).not.toContain(clientId);
		const visibleContracts = (await (await authGet('/api/contracts-by-client')).json()).contracts;
		expect(visibleContracts.map((contract: { id: string }) => contract.id)).not.toContain(contractId);

		expect(await runJson(['client', 'unarchive', SHORT_CODE])).toMatchObject({ archived: false });
		expect((await runJson(['clients'])).map((client: { id: string }) => client.id)).toContain(clientId);
	});

	it('removes the client only with --yes, and the entry is reassigned', async () => {
		const refused = await runCli(['client', 'remove', SHORT_CODE, '--json']);
		expect(refused.exitCode).toBe(2);
		expect(JSON.parse(refused.stderr).error).toContain('1 time entry (1h15m)');
		expect((await authGet(`/api/clients/${clientId}`)).status).toBe(200);

		const removed = await runJson(['client', 'remove', SHORT_CODE, '--yes']);
		expect(removed).toMatchObject({ deleted: { kind: 'client', id: clientId }, reassignedTimeEntryCount: 1, deletedContractCount: 1, minutesMoved: 75 });

		const { entry } = await (await authGet(`/api/time-entries/${entryId}`)).json();
		expect(entry.contractId).not.toBe(contractId);
		expect(entry).toMatchObject({ deliverableId: null, workTypeId: null, contractName: 'Deleted Contract' });
		expect(entry.description).toContain(`Formerly: Rocket Works / Launch site / Phase 1 / Visual design`);
		expect((await authGet(`/api/clients/${clientId}`)).status).toBe(404);
	});
});
