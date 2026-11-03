import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { edit, undo } from './correct.mjs';
import { readLastEntry, recordLastEntry } from '../lib/history.mjs';
import { UsageError } from '../lib/args.mjs';

const ENTRY_ID = '11111111-2222-3333-4444-555555555555';
const CONTRACT_ID = '99999999-2222-3333-4444-555555555555';

function fakeApi(responses = {}) {
	const calls = [];
	const respond = (method) => async (path, body) => {
		calls.push({ method, path, body });
		const handler = responses[`${method} ${path.split('?')[0]}`];
		if (handler instanceof Error) throw handler;
		return typeof handler === 'function' ? handler(body) : handler;
	};
	return { calls, get: respond('GET'), post: respond('POST'), patch: respond('PATCH'), delete: respond('DELETE') };
}

const storedEntry = {
	id: ENTRY_ID,
	contractId: CONTRACT_ID,
	date: '2026-11-03',
	durationMinutes: 90,
	description: 'Fixed it',
	clientShortCode: 'ACME',
	contractName: 'Website'
};

describe('chronolog edit', () => {
	it('sends only the given fields as a PATCH, resolving date words and the deliverable', async () => {
		const api = fakeApi({
			'GET /api/me': { today: '2026-11-03' },
			[`GET /api/time-entries/${ENTRY_ID}`]: { entry: storedEntry },
			'GET /api/deliverables': [{ id: 'd-1', name: 'Phase 2' }],
			[`PATCH /api/time-entries/${ENTRY_ID}`]: { success: true }
		});
		const printed = [];
		await edit({
			api,
			print: (text) => printed.push(text),
			positionals: [ENTRY_ID],
			flags: { duration: '1h30m', date: 'yesterday', deliverable: 'phase 2', description: 'Fixed it' }
		});
		const patch = api.calls.find((call) => call.method === 'PATCH');
		expect(patch.body).toEqual({ duration: '1h30m', description: 'Fixed it', date: '2026-11-02', deliverableId: 'd-1' });
		expect(printed[0]).toContain('Updated 1h30m on 2026-11-03 ACME/Website: Fixed it');
	});

	it('clears the deliverable with --deliverable none', async () => {
		const api = fakeApi({ [`GET /api/time-entries/${ENTRY_ID}`]: { entry: storedEntry } });
		await edit({ api, print: () => {}, positionals: [ENTRY_ID], flags: { deliverable: 'none' } });
		expect(api.calls.find((call) => call.method === 'PATCH').body).toEqual({ deliverableId: null });
	});

	it('refuses a missing id, a non-UUID id and an empty change', async () => {
		const api = fakeApi();
		await expect(edit({ api, print: () => {}, positionals: [], flags: {} })).rejects.toThrow(UsageError);
		await expect(edit({ api, print: () => {}, positionals: ['42'], flags: { duration: '1h' } })).rejects.toThrow(UsageError);
		await expect(edit({ api, print: () => {}, positionals: [ENTRY_ID], flags: {} })).rejects.toThrow('Nothing to change');
		expect(api.calls).toHaveLength(0);
	});
});

describe('chronolog undo', () => {
	let environment;
	const config = { baseUrl: 'http://chronolog.test' };

	beforeEach(() => {
		environment = { CHRONOLOG_CONFIG: join(mkdtempSync(join(tmpdir(), 'chronolog-undo-')), 'config.json') };
	});

	it('refuses when nothing is recorded', async () => {
		await expect(undo({ api: fakeApi(), print: () => {}, config, environment })).rejects.toThrow('Nothing to undo');
	});

	it('deletes the recorded entry once, then refuses', async () => {
		recordLastEntry({ entryId: ENTRY_ID, baseUrl: config.baseUrl, summary: '1h on 2026-11-03' }, environment);
		const api = fakeApi({ [`DELETE /api/time-entries/${ENTRY_ID}`]: { success: true } });
		const printed = [];
		await undo({ api, print: (text) => printed.push(text), config, environment });
		expect(api.calls).toEqual([{ method: 'DELETE', path: `/api/time-entries/${ENTRY_ID}`, body: undefined }]);
		expect(printed[0]).toContain('Deleted 1h on 2026-11-03');
		expect(readLastEntry(environment)).toBeNull();
		await expect(undo({ api, print: () => {}, config, environment })).rejects.toThrow('Nothing to undo');
	});

	it('refuses an entry recorded against another server', async () => {
		recordLastEntry({ entryId: ENTRY_ID, baseUrl: 'http://elsewhere.test' }, environment);
		const api = fakeApi();
		await expect(undo({ api, print: () => {}, config, environment })).rejects.toThrow(UsageError);
		expect(api.calls).toHaveLength(0);
		expect(readLastEntry(environment)).not.toBeNull();
	});

	it('forgets an entry that was already deleted in the app', async () => {
		recordLastEntry({ entryId: ENTRY_ID, baseUrl: config.baseUrl }, environment);
		const gone = Object.assign(new Error('Entry not found'), { status: 404, code: 'not_found' });
		const api = fakeApi({ [`DELETE /api/time-entries/${ENTRY_ID}`]: gone });
		await expect(undo({ api, print: () => {}, config, environment })).rejects.toThrow('no longer exists');
		expect(readLastEntry(environment)).toBeNull();
	});
});
