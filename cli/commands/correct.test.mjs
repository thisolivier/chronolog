import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { edit, undo } from './correct.mjs';
import { readLastEntry, recordLastEntry } from '../lib/history.mjs';
import { UsageError } from '../lib/args.mjs';
import { ReferenceError_ } from '../lib/resolve.mjs';

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
		expect(api.calls.find((call) => call.method === 'PATCH').body).toEqual({ deliverableId: null, workTypeId: null });
	});

	it('refuses a missing id, a non-UUID id and an empty change', async () => {
		const api = fakeApi();
		await expect(edit({ api, print: () => {}, positionals: [], flags: {} })).rejects.toThrow(UsageError);
		await expect(edit({ api, print: () => {}, positionals: ['42'], flags: { duration: '1h' } })).rejects.toThrow(UsageError);
		await expect(edit({ api, print: () => {}, positionals: [ENTRY_ID], flags: {} })).rejects.toThrow('Nothing to change');
		expect(api.calls).toHaveLength(0);
	});
});

describe('chronolog edit --deliverable / --work-type (sprint 032-CL)', () => {
	const entryWithWorkType = {
		...storedEntry,
		deliverableId: 'd-discovery',
		deliverableName: 'Discovery',
		workTypeId: 'w-interviews',
		workTypeName: 'Interviews'
	};
	const deliverables = [
		{ id: 'd-discovery', name: 'Discovery' },
		{ id: 'd-recommendations', name: 'Recommendations' }
	];
	const workTypesByDeliverable = {
		'd-discovery': [{ id: 'w-interviews', name: 'Interviews' }, { id: 'w-survey', name: 'Survey' }],
		'd-recommendations': [{ id: 'w-drafting', name: 'Drafting' }]
	};

	function apiFor(entry) {
		const api = fakeApi({
			[`GET /api/time-entries/${ENTRY_ID}`]: { entry },
			'GET /api/deliverables': deliverables,
			[`PATCH /api/time-entries/${ENTRY_ID}`]: { success: true }
		});
		const plainGet = api.get;
		api.get = async (path) => {
			const match = path.match(/^\/api\/work-types\?deliverableId=(.+)$/);
			if (match) {
				api.calls.push({ method: 'GET', path });
				return workTypesByDeliverable[match[1]] ?? [];
			}
			return plainGet(path);
		};
		return api;
	}
	const patchBody = (api) => api.calls.find((call) => call.method === 'PATCH')?.body;

	it('resolves --work-type under the entry’s current deliverable', async () => {
		const api = apiFor(entryWithWorkType);
		await edit({ api, print: () => {}, positionals: [ENTRY_ID], flags: { workType: 'survey' } });
		expect(patchBody(api)).toEqual({ workTypeId: 'w-survey' });
	});

	it('resolves --work-type under a new --deliverable', async () => {
		const api = apiFor(entryWithWorkType);
		await edit({ api, print: () => {}, positionals: [ENTRY_ID], flags: { deliverable: 'recommendations', tag: 'drafting' } });
		expect(patchBody(api)).toEqual({ deliverableId: 'd-recommendations', workTypeId: 'w-drafting' });
	});

	it('a work type from another deliverable is an unknown reference listing this deliverable’s work types', async () => {
		const api = apiFor(entryWithWorkType);
		const failure = await edit({ api, print: () => {}, positionals: [ENTRY_ID], flags: { workType: 'drafting' } }).catch(
			(caught) => caught
		);
		expect(failure).toBeInstanceOf(ReferenceError_);
		expect(failure.message).toBe('No work type matches “drafting” under deliverable “Discovery”.');
		expect(failure.candidates.join('\n')).toContain('Interviews');
		expect(patchBody(api)).toBeUndefined();
	});

	it('a new deliverable without --work-type clears the old deliverable’s work type', async () => {
		const api = apiFor(entryWithWorkType);
		await edit({ api, print: () => {}, positionals: [ENTRY_ID], flags: { deliverable: 'recommendations' } });
		expect(patchBody(api)).toEqual({ deliverableId: 'd-recommendations', workTypeId: null });
	});

	it('--work-type none clears only the work type', async () => {
		const api = apiFor(entryWithWorkType);
		await edit({ api, print: () => {}, positionals: [ENTRY_ID], flags: { workType: 'none' } });
		expect(patchBody(api)).toEqual({ workTypeId: null });
	});

	it('refuses a work type on an entry with no deliverable, and with --deliverable none', async () => {
		const noDeliverable = apiFor(storedEntry);
		await expect(
			edit({ api: noDeliverable, print: () => {}, positionals: [ENTRY_ID], flags: { workType: 'survey' } })
		).rejects.toThrow(UsageError);
		const clearing = apiFor(entryWithWorkType);
		await expect(
			edit({ api: clearing, print: () => {}, positionals: [ENTRY_ID], flags: { deliverable: 'none', workType: 'survey' } })
		).rejects.toThrow(UsageError);
		expect(patchBody(noDeliverable)).toBeUndefined();
		expect(patchBody(clearing)).toBeUndefined();
	});

	it('prints the deliverable and work type of the updated entry', async () => {
		const api = apiFor(entryWithWorkType);
		const printed = [];
		await edit({ api, print: (text) => printed.push(text), positionals: [ENTRY_ID], flags: { workType: 'interviews' } });
		expect(printed[0]).toContain('[Discovery > Interviews]');
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
