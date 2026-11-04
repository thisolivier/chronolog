/**
 * Sprint 032-CL: an entry's work type must be under its deliverable, through the CLI (a child
 * process against the live server) and the API. `chronolog edit --work-type` succeeds under the
 * entry's deliverable and exits 3 with candidates for one from another deliverable; `log` does
 * the same; the API answers 400 `work_type_mismatch` to a stale pair.
 */
import './test-init';
import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL, authGet, authPost, authPut } from './helpers';

const CLI_PATH = join(import.meta.dirname, '..', '..', 'cli', 'chronolog.mjs');
const CONFIG_PATH = join(mkdtempSync(join(tmpdir(), 'chronolog-cli-032-')), 'config.json');
const SHORT_CODE = `W${Date.now().toString(36).slice(-5).toUpperCase()}`;
const CONTRACT = `${SHORT_CODE}/Research`;

let rawToken = '';
let entryId = '';
const ids: Record<string, string> = {};

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

async function storedEntry() {
	return (await (await authGet(`/api/time-entries/${entryId}`)).json()).entry;
}

beforeAll(async () => {
	const tokenResponse = await authPost('/api/tokens', { name: 'e2e 032 laptop' });
	expect(tokenResponse.status).toBe(201);
	rawToken = (await tokenResponse.json()).rawToken;

	await runJson(['client', 'add', 'Work Type Co', '--code', SHORT_CODE]);
	ids.contract = (await runJson(['contract', 'add', SHORT_CODE, 'Research'])).id;
	ids.discovery = (await runJson(['deliverable', 'add', CONTRACT, 'Discovery'])).id;
	ids.recommendations = (await runJson(['deliverable', 'add', CONTRACT, 'Recommendations'])).id;
	ids.interviews = (await runJson(['work-type', 'add', `${CONTRACT}/Discovery`, 'Interviews'])).id;
	ids.survey = (await runJson(['work-type', 'add', `${CONTRACT}/Discovery`, 'Survey'])).id;
	ids.drafting = (await runJson(['work-type', 'add', `${CONTRACT}/Recommendations`, 'Drafting'])).id;

	entryId = (
		await runJson(['log', CONTRACT, '1h', 'Stakeholder interviews', '--date', '2026-03-04', '--deliverable', 'Discovery', '--work-type', 'Interviews'])
	).id;
});

describe('chronolog edit --work-type', () => {
	it('changes the work type under the entry’s deliverable', async () => {
		const result = await runCli(['edit', entryId, '--work-type', 'survey']);
		expect(result.exitCode, result.stderr).toBe(0);
		expect(result.stdout).toContain('[Discovery > Survey]');
		expect(await storedEntry()).toMatchObject({ deliverableId: ids.discovery, workTypeId: ids.survey });
	});

	it('exits 3 with this deliverable’s work types for one from another deliverable; nothing changes', async () => {
		const result = await runCli(['edit', entryId, '--work-type', 'Drafting', '--json']);
		expect(result.exitCode).toBe(3);
		const failure = JSON.parse(result.stderr);
		expect(failure.error).toBe('No work type matches “Drafting” under deliverable “Discovery”.');
		expect(failure.candidates.join('\n')).toContain('Interviews');
		expect(failure.candidates.join('\n')).toContain('Survey');
		expect(failure.candidates.join('\n')).not.toContain('Drafting');
		expect(await storedEntry()).toMatchObject({ workTypeId: ids.survey });
	});

	it('moves deliverable and work type together, and --deliverable none clears both', async () => {
		await runJson(['edit', entryId, '--deliverable', 'Recommendations', '--tag', 'Drafting']);
		expect(await storedEntry()).toMatchObject({ deliverableId: ids.recommendations, workTypeId: ids.drafting });

		await runJson(['edit', entryId, '--deliverable', 'Discovery']);
		expect(await storedEntry()).toMatchObject({ deliverableId: ids.discovery, workTypeId: null });

		await runJson(['edit', entryId, '--deliverable', 'none']);
		expect(await storedEntry()).toMatchObject({ deliverableId: null, workTypeId: null });

		const noDeliverable = await runCli(['edit', entryId, '--work-type', 'Interviews']);
		expect(noDeliverable.exitCode).toBe(2);
	});
});

describe('chronolog log --work-type', () => {
	it('exits 3 for a work type that is not under the deliverable, logging nothing', async () => {
		const before = await (await authGet(`/api/time-entries?from=2026-03-05&to=2026-03-05`)).json();
		const result = await runCli(['log', CONTRACT, '30m', 'Wrong pair', '--date', '2026-03-05', '--deliverable', 'Discovery', '--work-type', 'Drafting']);
		expect(result.exitCode).toBe(3);
		expect(result.stderr).toContain('under deliverable “Discovery”');
		const after = await (await authGet(`/api/time-entries?from=2026-03-05&to=2026-03-05`)).json();
		expect(after.entries.length).toBe(before.entries.length);
	});
});

describe('the API refuses a stale pair', () => {
	it('PUT with a new deliverable and the old work type is 400 work_type_mismatch naming both deliverables', async () => {
		await runJson(['edit', entryId, '--deliverable', 'Discovery', '--work-type', 'Interviews']);
		const response = await authPut(`/api/time-entries/${entryId}`, { deliverableId: ids.recommendations });
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			code: 'work_type_mismatch',
			error: 'Work type "Interviews" belongs to deliverable "Discovery", not "Recommendations"'
		});
		expect(await storedEntry()).toMatchObject({ deliverableId: ids.discovery, workTypeId: ids.interviews });
	});

	it('POST with a work type and no deliverable is 400 work_type_mismatch', async () => {
		const response = await authPost('/api/time-entries', {
			contractId: ids.contract,
			date: '2026-03-06',
			duration: '30m',
			workTypeId: ids.interviews
		});
		expect(response.status).toBe(400);
		expect((await response.json()).code).toBe('work_type_mismatch');
	});
});
