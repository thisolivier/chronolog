import { describe, expect, it } from 'vitest';
import { formatTotal, total } from './total.mjs';
import { UsageError } from '../lib/args.mjs';
import { ReferenceError_ } from '../lib/resolve.mjs';

const WEBSITE_ID = '11111111-2222-3333-4444-555555555555';
const APP_ID = '11111111-2222-3333-4444-666666666666';
const OTHER_ID = '11111111-2222-3333-4444-777777777777';
const OLD_ID = '11111111-2222-3333-4444-888888888888';
const contractsList = {
	contracts: [
		{ id: WEBSITE_ID, name: 'Website', clientShortCode: 'ACME', clientName: 'Acme', clientId: 'c-acme' },
		{ id: APP_ID, name: 'Website app', clientShortCode: 'ACME', clientName: 'Acme', clientId: 'c-acme' },
		{ id: OTHER_ID, name: 'Retainer', clientShortCode: 'BETA', clientName: 'Beta', clientId: 'c-beta' },
		{ id: OLD_ID, name: 'Old audit', clientShortCode: 'ACME', clientName: 'Acme', clientId: 'c-acme', archived: true }
	]
};
const clientList = { clients: [{ id: 'c-acme', shortCode: 'ACME', name: 'Acme' }, { id: 'c-beta', shortCode: 'BETA', name: 'Beta' }] };
const me = { today: '2026-11-11', weekStart: '2026-11-09', weekEnd: '2026-11-15' };
const reply = {
	from: '2026-11-09',
	to: '2026-11-15',
	totalMinutes: 750,
	entryCount: 14,
	contracts: [
		{ contractId: WEBSITE_ID, contractName: 'Website', clientName: 'Acme', clientShortCode: 'ACME', totalMinutes: 495, entryCount: 9 },
		{ contractId: OTHER_ID, contractName: 'Retainer', clientName: 'Beta', clientShortCode: 'BETA', totalMinutes: 255, entryCount: 5 }
	]
};

function fakeApi() {
	const calls = [];
	const responses = { '/api/contracts-by-client': contractsList, '/api/clients': clientList, '/api/me': me, '/api/time-entries/total': reply };
	return {
		calls,
		get: async (path) => {
			calls.push(path);
			return responses[path.split('?')[0]];
		}
	};
}

async function run(flags, flagValues = {}) {
	const api = fakeApi();
	const printed = [];
	await total({ api, print: (text, json) => printed.push({ text, json }), flags, flagValues });
	const totalCall = api.calls.find((path) => path.startsWith('/api/time-entries/total'));
	return { api, printed: printed[0], query: totalCall ? new URL(`http://x${totalCall}`).searchParams : null };
}

describe('chronolog total', () => {
	it('needs contracts: --contract, --client or --all-contracts (usage error)', async () => {
		await expect(run({})).rejects.toThrow(UsageError);
	});

	it('defaults to the current week from /api/me', async () => {
		const { query } = await run({ allContracts: true });
		expect(query.get('from')).toBe('2026-11-09');
		expect(query.get('to')).toBe('2026-11-15');
		expect(query.get('contracts')).toBe('all');
	});

	it('--all-time sends no bounds and never asks /api/me', async () => {
		const { query, api } = await run({ allContracts: true, allTime: true });
		expect(query.has('from')).toBe(false);
		expect(query.has('to')).toBe(false);
		expect(api.calls).not.toContain('/api/me');
	});

	it('--from alone is open-ended and takes date words; --to alone likewise', async () => {
		let { query } = await run({ allContracts: true, from: 'monday' });
		expect(query.get('from')).toBe('2026-11-09');
		expect(query.has('to')).toBe(false);
		({ query } = await run({ allContracts: true, to: 'yesterday' }));
		expect(query.get('to')).toBe('2026-11-10');
		expect(query.has('from')).toBe(false);
	});

	it('refuses bad dates, a reversed range and --all-time with bounds', async () => {
		await expect(run({ allContracts: true, from: 'someday' })).rejects.toThrow(UsageError);
		await expect(run({ allContracts: true, from: '2026-11-10', to: '2026-11-01' })).rejects.toThrow(UsageError);
		await expect(run({ allContracts: true, allTime: true, from: '2026-11-01' })).rejects.toThrow(UsageError);
	});

	it('repeated --contract and --client resolve to IDs without duplicates', async () => {
		const { query } = await run(
			{ contract: 'BETA/Retainer', client: 'ACME' },
			{ contract: ['ACME/Website', 'BETA/Retainer'], client: ['ACME'] }
		);
		expect(query.get('contracts')).toBe([WEBSITE_ID, OTHER_ID, APP_ID, OLD_ID].join(','));
	});

	it('resolves archived contracts and clients (lists fetched with includeArchived)', async () => {
		const { query, api } = await run({ contract: 'ACME/Old audit' }, { contract: ['ACME/Old audit'] });
		expect(query.get('contracts')).toBe(OLD_ID);
		expect(api.calls).toContain('/api/contracts-by-client?includeArchived=true');
		const byClient = await run({ client: 'ACME' }, { client: ['ACME'] });
		expect(byClient.api.calls).toContain('/api/clients?includeArchived=true');
	});

	it('refuses --contract or --client with --all-contracts, before any request', async () => {
		const attempt = run({ contract: 'ACME/Website', allContracts: true }, { contract: ['ACME/Website'] });
		await expect(attempt).rejects.toThrow(UsageError);
		await expect(run({ client: 'ACME', allContracts: true }, { client: ['ACME'] })).rejects.toThrow(UsageError);
	});

	it('refuses a date that is not a real day, before asking for the total', async () => {
		const api = fakeApi();
		await expect(total({ api, print: () => {}, flags: { allContracts: true, from: '2026-02-30' }, flagValues: {} })).rejects.toThrow(UsageError);
		expect(api.calls.some((path) => path.startsWith('/api/time-entries/total'))).toBe(false);
	});

	it('never guesses an ambiguous contract (exit 3 with candidates)', async () => {
		const failure = await run({ contract: 'website' }, { contract: ['website'] }).catch((error) => error);
		expect(failure).toBeInstanceOf(ReferenceError_);
		expect(failure.code).toBe('ambiguous');
		expect(failure.candidates).toHaveLength(2);
	});

	it('prints the header and one aligned line per contract; --json keeps the reply and adds range and selection', async () => {
		const { printed } = await run({ contract: 'ACME/Website' }, { contract: ['ACME/Website'] });
		expect(printed.text).toBe(
			['Total 12h30m (14 entries) · 2026-11-09 to 2026-11-15', '  ACME/Website   8h15m  (9)', '  BETA/Retainer  4h15m  (5)'].join('\n')
		);
		expect(printed.json).toEqual({
			...reply,
			range: { from: '2026-11-09', to: '2026-11-15' },
			selection: [{ id: WEBSITE_ID, clientShortCode: 'ACME', name: 'Website' }]
		});
		expect((await run({ allContracts: true })).printed.json.selection).toBe('all');
	});
});

describe('formatTotal', () => {
	it('says all time and the singular entry', () => {
		const text = formatTotal({ totalMinutes: 30, entryCount: 1, contracts: [] }, { from: null, to: null });
		expect(text).toBe('Total 30m (1 entry) · all time');
	});
});
