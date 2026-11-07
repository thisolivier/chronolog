import { describe, expect, it } from 'vitest';
import { parseAtFlag, timerAdjust, timerStart, timerStatus, timerStop, catchNotChanged } from './timer.mjs';
import { UsageError } from '../lib/args.mjs';
import { ApiError } from '../lib/api.mjs';

const CONTRACT_ID = '99999999-2222-3333-4444-555555555555';
const contractsList = { contracts: [{ id: CONTRACT_ID, name: 'Website', clientShortCode: 'ACME', clientName: 'Acme', clientId: 'c1' }] };
const runningTimer = {
	id: 't-1', date: '2026-11-04', startTime: '09:30:00', endTime: null, durationMinutes: 0,
	contractId: CONTRACT_ID, contractName: 'Website', clientShortCode: 'ACME', description: 'Fixing'
};
const overlap = () => new ApiError(409, 'This start is before the end of Acme / Website 09:00–10:00 on 2026-11-04.', 'start_overlaps_entry');

function fakeApi(responses = {}) {
	const calls = [];
	const respond = (method) => async (path, body) => {
		calls.push({ method, path, body });
		const handler = responses[`${method} ${path.split('?')[0]}`];
		const result = typeof handler === 'function' ? handler(body) : handler;
		if (result instanceof Error) throw result;
		return result;
	};
	return { calls, get: respond('GET'), post: respond('POST'), put: respond('PUT'), patch: respond('PATCH') };
}
const quietStderr = { write: () => true };
const noTerminal = { isTTY: false };

describe('parseAtFlag', () => {
	it('reads HH:MM, a date word before it, and refuses the rest', () => {
		expect(parseAtFlag('9:30', '2026-11-04')).toEqual({ startTime: '09:30:00' });
		expect(parseAtFlag('yesterday 23:10', '2026-11-04')).toEqual({ date: '2026-11-03', startTime: '23:10:00' });
		expect(parseAtFlag('2026-11-02 08:05', '2026-11-04')).toEqual({ date: '2026-11-02', startTime: '08:05:00' });
		expect(parseAtFlag('25:00', '2026-11-04')).toBeNull();
		expect(parseAtFlag('someday 9:00', '2026-11-04')).toBeNull();
		expect(parseAtFlag('half past nine', '2026-11-04')).toBeNull();
	});
});

describe('chronolog timer start', () => {
	it('starts now on the contract without asking, and sets the description', async () => {
		const api = fakeApi({ 'GET /api/contracts-by-client': contractsList, 'POST /api/timer/start': { ...runningTimer }, 'PUT /api/time-entries/t-1': {} });
		const printed = [];
		await timerStart({ api, print: (text) => printed.push(text), positionals: ['ACME/Website', 'Fixing'], flags: {} });
		const start = api.calls.find((call) => call.method === 'POST');
		expect(start.body).toMatchObject({ contractId: CONTRACT_ID, confirmed: true });
		expect(start.body.startTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
		expect(api.calls.find((call) => call.method === 'PUT').body).toEqual({ description: 'Fixing' });
		expect(printed[0]).toContain('Timer started at 2026-11-04 09:30 on ACME/Website: Fixing');
	});

	it('--at sends the chosen start unconfirmed; an overlap needs --yes without a terminal', async () => {
		const api = fakeApi({
			'GET /api/contracts-by-client': contractsList,
			'POST /api/timer/start': (body) => (body.confirmed ? { ...runningTimer } : overlap())
		});
		const context = { api, print: () => {}, positionals: ['ACME/Website'], stdin: noTerminal, stderr: quietStderr };
		await expect(timerStart({ ...context, flags: { at: '09:30' } })).rejects.toThrow(UsageError);
		await timerStart({ ...context, flags: { at: '09:30', yes: true } });
		const starts = api.calls.filter((call) => call.method === 'POST');
		expect(starts.map((call) => call.body.confirmed)).toEqual([false, false, true]);
		expect(starts[2].body.startTime).toBe('09:30:00');
	});

	it('needs a contract and a readable --at', async () => {
		const api = fakeApi({ 'GET /api/contracts-by-client': contractsList });
		await expect(timerStart({ api, print: () => {}, positionals: [], flags: {} })).rejects.toThrow(UsageError);
		await expect(timerStart({ api, print: () => {}, positionals: ['ACME/Website'], flags: { at: 'soon' } })).rejects.toThrow(UsageError);
	});
});

describe('chronolog timer adjust', () => {
	it('patches the start; the date only when given', async () => {
		const api = fakeApi({ 'PATCH /api/timer': { ...runningTimer, startTime: '08:45:00' } });
		const printed = [];
		await timerAdjust({ api, print: (text) => printed.push(text), flags: { at: '8:45' } });
		expect(api.calls[0].body).toEqual({ startTime: '08:45:00', confirmed: false });
		expect(printed[0]).toContain('Timer now started at 2026-11-04 08:45 ACME/Website');
		await timerAdjust({ api, print: () => {}, flags: { at: 'yesterday 23:10' } });
		expect(api.calls[1].body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('an overlap warns; --yes resends confirmed; a "no" on a terminal prints and changes nothing', async () => {
		const api = fakeApi({ 'PATCH /api/timer': (body) => (body.confirmed ? { ...runningTimer } : overlap()) });
		const warnings = [];
		const stderr = { write: (text) => warnings.push(text) };
		await timerAdjust({ api, print: () => {}, flags: { at: '09:30', yes: true }, stdin: noTerminal, stderr });
		expect(warnings[0]).toContain('Warning: This start is before the end of Acme / Website');
		expect(api.calls.map((call) => call.body.confirmed)).toEqual([false, true]);

		const printed = [];
		const wrapped = catchNotChanged(async () => {
			const { StartNotChanged } = await import('./timer.mjs');
			throw new StartNotChanged('Start not changed.');
		});
		await wrapped({ print: (text) => printed.push(text) });
		expect(printed).toEqual(['Start not changed.']);
	});

	it('needs --at', async () => {
		await expect(timerAdjust({ api: fakeApi(), print: () => {}, flags: {} })).rejects.toThrow(UsageError);
	});
});

describe('chronolog timer and timer stop', () => {
	it('status says running, stopped or none', async () => {
		const printed = [];
		await timerStatus({ api: fakeApi({ 'GET /api/timer/status': { timer: runningTimer } }), print: (text) => printed.push(text) });
		await timerStatus({ api: fakeApi({ 'GET /api/timer/status': { timer: null } }), print: (text) => printed.push(text) });
		expect(printed[0]).toMatch(/^Running .* since 2026-11-04 09:30 ACME\/Website: Fixing/);
		expect(printed[1]).toBe('No timer running.');
	});

	it('stop stops and saves on the timer contract', async () => {
		const api = fakeApi({
			'GET /api/timer/status': { timer: runningTimer },
			'POST /api/timer/stop': { ...runningTimer, endTime: '10:15:00', durationMinutes: 45 },
			'POST /api/timer/save': { id: 't-1', isDraft: false }
		});
		const printed = [];
		await timerStop({ api, print: (text) => printed.push(text) });
		expect(api.calls.find((call) => call.path === '/api/timer/save').body).toMatchObject({ entryId: 't-1', contractId: CONTRACT_ID, description: 'Fixing', expectedStartedAt: `${runningTimer.date}T${runningTimer.startTime}` });
		expect(printed[0]).toContain('Saved 45m (09:30-10:15) on 2026-11-04 to ACME/Website: Fixing');
		await expect(timerStop({ api: fakeApi({ 'GET /api/timer/status': { timer: null } }), print: () => {} })).rejects.toThrow(UsageError);
	});
});
