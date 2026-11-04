/**
 * Sprint 041-CL: `chronolog timer start --at`, `timer adjust`, `timer` and `timer stop` against the
 * live server. A logged entry 120 to 60 minutes ago makes a start 90 minutes ago an overlap: it
 * warns and needs `--yes` (no terminal here); a future start is refused; the saved entry measures
 * from the adjusted start.
 */
import './test-init';
import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL, authDelete, authGet, authPost } from './helpers';

const CLI_PATH = join(import.meta.dirname, '..', '..', 'cli', 'chronolog.mjs');
const CONFIG_PATH = join(mkdtempSync(join(tmpdir(), 'chronolog-cli-041-')), 'config.json');

let rawToken = '';
let contractId = '';

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

const pad = (value: number) => String(value).padStart(2, '0');
/** Local `HH:MM` `minutesAgo` minutes before now. */
function clockMinutesAgo(minutesAgo: number): string {
	const moment = new Date(Date.now() - minutesAgo * 60_000);
	return `${pad(moment.getHours())}:${pad(moment.getMinutes())}`;
}

// The relative times below must all fall on today
const isEarlyMorning = new Date().getHours() < 3;

beforeAll(async () => {
	const tokenResponse = await authPost('/api/tokens', { name: 'e2e 041 laptop' });
	expect(tokenResponse.status).toBe(201);
	rawToken = (await tokenResponse.json()).rawToken;
	const contractsResponse = await authGet('/api/contracts-by-client');
	contractId = (await contractsResponse.json()).contracts[0].id;
	// Other files log entries at fixed times today for the same throwaway user: clear the window
	const today = new Date();
	const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const isoDate = (moment: Date) => `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;
	const listResponse = await authGet(`/api/time-entries?from=${isoDate(yesterday)}&to=${isoDate(today)}`);
	expect(listResponse.status).toBe(200);
	for (const entry of (await listResponse.json()).entries) {
		expect((await authDelete(`/api/time-entries/${entry.id}`)).ok).toBe(true);
	}
});

describe.skipIf(isEarlyMorning)('chronolog timer', () => {
	it('logs an entry 120 to 60 minutes ago', async () => {
		const logged = await runJson(['log', contractId, `${clockMinutesAgo(120)}-${clockMinutesAgo(60)}`, 'Earlier work']);
		expect(logged.durationMinutes).toBe(60);
	});

	it('timer start --at inside that entry warns and needs --yes without a terminal', async () => {
		const refused = await runCli(['timer', 'start', contractId, 'Timer from the CLI', '--at', clockMinutesAgo(90)]);
		expect(refused.exitCode).toBe(2);
		expect(refused.stderr).toContain('Warning: This start is before the end of');
		expect(refused.stderr).toContain('--yes');
		expect((await (await authGet('/api/timer/status')).json()).timer).toBeNull();

		const started = await runJson(['timer', 'start', contractId, 'Timer from the CLI', '--at', clockMinutesAgo(90), '--yes']);
		expect(started.startTime.slice(0, 5)).toBe(clockMinutesAgo(90));
		expect(started.description).toBe('Timer from the CLI');
	});

	it('timer adjust moves the start; the future is refused; an overlap needs --yes', async () => {
		const later = await runJson(['timer', 'adjust', '--at', clockMinutesAgo(30)]);
		expect(later.startTime.slice(0, 5)).toBe(clockMinutesAgo(30));

		const future = await runCli(['timer', 'adjust', '--at', clockMinutesAgo(-30), '--json']);
		expect(future.exitCode).toBe(1);
		expect(JSON.parse(future.stderr).code).toBe('start_in_future');

		const overlapping = await runCli(['timer', 'adjust', '--at', clockMinutesAgo(100)]);
		expect(overlapping.exitCode).toBe(2);
		const confirmed = await runJson(['timer', 'adjust', '--at', clockMinutesAgo(100), '--yes']);
		expect(confirmed.startTime.slice(0, 5)).toBe(clockMinutesAgo(100));

		const status = await runJson(['timer']);
		expect(status.timer.startTime.slice(0, 5)).toBe(clockMinutesAgo(100));
		const human = await runCli(['timer']);
		expect(human.stdout).toMatch(/^Running 1h4\dm since /);
	});

	it('timer stop saves the entry measured from the adjusted start', async () => {
		const result = await runCli(['timer', 'stop']);
		expect(result.exitCode, result.stderr).toBe(0);
		expect(result.stdout).toMatch(/^Saved 1h4\dm \(/);
		const { timer } = await (await authGet('/api/timer/status')).json();
		expect(timer).toBeNull();
		const noTimer = await runCli(['timer', 'adjust', '--at', clockMinutesAgo(10)]);
		expect(noTimer.exitCode).toBe(1);
		expect(noTimer.stderr).toContain('No running timer');
	});
});
