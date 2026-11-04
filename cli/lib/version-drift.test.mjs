import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkIsDue, commitsDiffer, driftMessage, noticeVersionDrift, readCliCommit, versionCheckPath } from './version-drift.mjs';

const SERVER = 'aaaaaaa111111111111111111111111111111111';
const CLI = 'bbbbbbb222222222222222222222222222222222';

function setup({ serverCommit = SERVER, cliCommit = CLI } = {}) {
	const environment = { CHRONOLOG_CONFIG: join(mkdtempSync(join(tmpdir(), 'chronolog-drift-')), 'config.json') };
	const written = [];
	const calls = [];
	return {
		environment,
		written,
		calls,
		options: {
			api: { get: async (path) => (calls.push(path), { serverCommit }) },
			environment,
			stderr: { write: (text) => written.push(text) },
			readCommit: () => cliCommit
		}
	};
}

describe('commitsDiffer', () => {
	it('compares known commits, short against full', () => {
		expect(commitsDiffer(SERVER, CLI)).toBe(true);
		expect(commitsDiffer(SERVER, SERVER.slice(0, 7))).toBe(false);
		expect(commitsDiffer(SERVER.toUpperCase(), SERVER)).toBe(false);
	});
	it('says nothing when either side is unknown or a dev server', () => {
		expect(commitsDiffer('dev', CLI)).toBe(false);
		expect(commitsDiffer(undefined, CLI)).toBe(false);
		expect(commitsDiffer(SERVER, null)).toBe(false);
	});
});

describe('checkIsDue', () => {
	const now = new Date('2026-11-04T12:00:00Z');
	it('is due with no record, an old one or one dated in the future', () => {
		expect(checkIsDue(null, now)).toBe(true);
		expect(checkIsDue({ checkedAt: 'garbage' }, now)).toBe(true);
		expect(checkIsDue({ checkedAt: '2026-11-03T11:59:59Z' }, now)).toBe(true);
		expect(checkIsDue({ checkedAt: '2026-11-05T12:00:00Z' }, now)).toBe(true);
	});
	it('is not due within a day', () => {
		expect(checkIsDue({ checkedAt: '2026-11-03T12:00:01Z' }, now)).toBe(false);
	});
});

describe('noticeVersionDrift', () => {
	it('prints one stderr line on drift, then stays quiet for a day', async () => {
		const { options, written, calls, environment } = setup();
		const first = await noticeVersionDrift({ ...options, now: new Date('2026-11-04T09:00:00Z') });
		expect(first).toBe(driftMessage(SERVER, CLI));
		expect(written).toEqual(['chronolog: server is at aaaaaaa, this CLI at bbbbbbb: run git pull\n']);
		expect(JSON.parse(readFileSync(versionCheckPath(environment), 'utf8'))).toMatchObject({ serverCommit: SERVER, cliCommit: CLI });

		expect(await noticeVersionDrift({ ...options, now: new Date('2026-11-04T20:00:00Z') })).toBeNull();
		expect(calls).toHaveLength(1);
		expect(written).toHaveLength(1);

		expect(await noticeVersionDrift({ ...options, now: new Date('2026-11-05T09:00:01Z') })).not.toBeNull();
		expect(calls).toHaveLength(2);
	});

	it('says nothing when the commits match or the server is dev', async () => {
		for (const serverCommit of [CLI.slice(0, 7), 'dev']) {
			const { options, written } = setup({ serverCommit });
			expect(await noticeVersionDrift(options)).toBeNull();
			expect(written).toEqual([]);
		}
	});

	it('uses a /api/me answer the command already has', async () => {
		const { options, calls, written } = setup();
		await noticeVersionDrift({ ...options, meResult: { serverCommit: SERVER } });
		expect(calls).toEqual([]);
		expect(written).toHaveLength(1);
	});

	it('never throws: an unreachable server or unwritable cache skips the check', async () => {
		const { options, written } = setup();
		const failing = { ...options, api: { get: async () => Promise.reject(new Error('offline')) } };
		expect(await noticeVersionDrift(failing)).toBeNull();
		const unwritable = { ...options, environment: { CHRONOLOG_CONFIG: '/dev/null/nope/config.json' } };
		expect(await noticeVersionDrift(unwritable)).toBeNull();
		expect(written).toEqual([]);
	});

	it('is off with CHRONOLOG_NO_VERSION_CHECK', async () => {
		const { options, calls, environment } = setup();
		expect(await noticeVersionDrift({ ...options, environment: { ...environment, CHRONOLOG_NO_VERSION_CHECK: '1' } })).toBeNull();
		expect(calls).toEqual([]);
	});

	it('ignores a corrupt cache file', async () => {
		const { options, environment, written } = setup();
		writeFileSync(versionCheckPath(environment), '{not json');
		await noticeVersionDrift(options);
		expect(written).toHaveLength(1);
	});
});

describe('readCliCommit', () => {
	it('reads this checkout’s commit, or null outside git', () => {
		expect(readCliCommit()).toMatch(/^[0-9a-f]{40}$/);
		expect(readCliCommit(tmpdir())).toBeNull();
	});
});
