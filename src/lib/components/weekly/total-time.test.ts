import { describe, it, expect } from 'vitest';
import {
	contractStatusLabel,
	contractsForRequest,
	describeRange,
	isConnectionFailure,
	matchingPresetKey,
	orderContractsForPicker,
	rangePresets,
	totalDisplay
} from './total-time';
import type { TotalTimeResult } from '$lib/services/types';
import type { PickerContract } from './total-time';

describe('rangePresets', () => {
	it('offers all time, the viewed week, this week, month and year', () => {
		const presets = rangePresets('2026-11-09', '2026-10-26');
		expect(presets.map((preset) => [preset.key, preset.label, preset.range.from, preset.range.to])).toEqual([
			['all-time', 'All time', '', ''],
			['viewed-week', 'Week 44', '2026-10-26', '2026-11-01'],
			['this-week', 'This week', '2026-11-09', '2026-11-15'],
			['this-month', 'This month', '2026-11-01', '2026-11-30'],
			['this-year', 'This year', '2026-01-01', '2026-12-31']
		]);
	});

	it('leaves out the viewed week when it is this week', () => {
		expect(rangePresets('2026-11-11', '2026-11-09').map((preset) => preset.key)).not.toContain('viewed-week');
	});

	it('knows February in a leap year', () => {
		const thisMonth = rangePresets('2028-02-10', '2028-02-07').find((preset) => preset.key === 'this-month');
		expect(thisMonth?.range).toEqual({ from: '2028-02-01', to: '2028-02-29' });
	});
});

describe('matchingPresetKey', () => {
	const presets = rangePresets('2026-11-09', '2026-11-09');
	it('names the preset the range is', () => {
		expect(matchingPresetKey({ from: '', to: '' }, presets)).toBe('all-time');
		expect(matchingPresetKey({ from: '2026-11-01', to: '2026-11-30' }, presets)).toBe('this-month');
	});
	it('is null for a custom range', () => {
		expect(matchingPresetKey({ from: '2026-11-02', to: '' }, presets)).toBeNull();
	});
});

describe('describeRange', () => {
	it('words each kind of bound', () => {
		expect(describeRange({ from: '', to: '' })).toBe('all time');
		expect(describeRange({ from: '2026-11-02', to: '2026-11-08' })).toBe('2026-11-02 to 2026-11-08');
		expect(describeRange({ from: '2026-11-02', to: '' })).toBe('from 2026-11-02');
		expect(describeRange({ from: '', to: '2026-11-08' })).toBe('up to 2026-11-08');
	});
});

describe('orderContractsForPicker', () => {
	const contract = (id: string, isActive: boolean, archived = false, clientArchived = false) =>
		({ id, isActive, archived, clientArchived }) as PickerContract;

	it('keeps contracts in use apart from inactive and archived ones, in order', () => {
		const ordered = orderContractsForPicker([contract('a', true), contract('b', false), contract('c', true), contract('d', true, true)]);
		expect(ordered.shown.map((item) => item.id)).toEqual(['a', 'c']);
		expect(ordered.hidden.map((item) => item.id)).toEqual(['b', 'd']);
		expect(ordered.hasArchived).toBe(true);
		expect(orderContractsForPicker([contract('a', true), contract('b', false)]).hasArchived).toBe(false);
	});

	it('labels archived (contract or client) before inactive', () => {
		expect(contractStatusLabel(contract('a', true))).toBeNull();
		expect(contractStatusLabel(contract('b', false))).toBe('inactive');
		expect(contractStatusLabel(contract('c', false, true))).toBe('archived');
		expect(contractStatusLabel(contract('d', true, false, true))).toBe('archived');
	});
});

describe('contractsForRequest', () => {
	it('is all when every listed contract is ticked, so it matches the week total', () => {
		expect(contractsForRequest(['a', 'b'], new Set(['a', 'b']))).toBe('all');
	});
	it('lists the ticked ones otherwise, and none for none', () => {
		expect(contractsForRequest(['a', 'b', 'c'], new Set(['c', 'a']))).toEqual(['a', 'c']);
		expect(contractsForRequest(['a', 'b'], new Set())).toEqual([]);
		expect(contractsForRequest([], new Set())).toEqual([]);
	});
});

describe('totalDisplay', () => {
	const range = { from: '2026-11-02', to: '2026-11-08' };
	const result = (totalMinutes: number): TotalTimeResult => ({ from: null, to: null, totalMinutes, entryCount: 1, contracts: [] });
	const base = { selectedCount: 1, range, isLoading: false, failure: null, result: result(60) } as const;

	it('no contracts beats everything', () => {
		expect(totalDisplay({ ...base, selectedCount: 0 }).kind).toBe('no-contracts');
	});
	it('a reversed range is flagged, not fetched', () => {
		expect(totalDisplay({ ...base, range: { from: '2026-11-09', to: '2026-11-01' } }).kind).toBe('bad-range');
	});
	it('loading hides the previous total', () => {
		expect(totalDisplay({ ...base, isLoading: true }).kind).toBe('loading');
	});
	it('reports failures, zero time and the total', () => {
		expect(totalDisplay({ ...base, failure: 'offline', result: null }).kind).toBe('offline');
		expect(totalDisplay({ ...base, result: result(0) }).kind).toBe('empty');
		expect(totalDisplay(base)).toEqual({ kind: 'total', result: result(60) });
	});
});

describe('isConnectionFailure', () => {
	it('is true offline, for the online-only error and for a failed fetch', () => {
		expect(isConnectionFailure(new Error('x'), true)).toBe(true);
		const offlineError = Object.assign(new Error('Total time is not available offline'), { name: 'NotAvailableOfflineError' });
		expect(isConnectionFailure(offlineError, false)).toBe(true);
		expect(isConnectionFailure(new TypeError('Failed to fetch'), false)).toBe(true);
		expect(isConnectionFailure(new Error('500'), false)).toBe(false);
	});
});
