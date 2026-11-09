/**
 * Pure helpers for TotalTimeModal (sprint 065-TT): the quick date ranges, which one the current
 * range matches, the contract list order and the result's display state.
 */
import { getMondayOfWeek, getSundayOfWeek, isoWeekNumber } from '$lib/utils/iso-week';
import type { ContractOption, TotalTimeResult } from '$lib/services/types';

/** Inclusive bounds as the date inputs hold them: `''` is open-ended */
export type DateRange = { from: string; to: string };

export type RangePreset = { key: string; label: string; range: DateRange };

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

function lastDayOfMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The quick choices; "Viewed week" only when it is not the current week (it would repeat "This week") */
export function rangePresets(todayDate: string, viewedWeekStart: string): RangePreset[] {
	const [year, month] = todayDate.split('-').map(Number);
	const thisWeekStart = getMondayOfWeek(todayDate);
	const presets: RangePreset[] = [{ key: 'all-time', label: 'All time', range: { from: '', to: '' } }];
	if (viewedWeekStart !== thisWeekStart) {
		presets.push({
			key: 'viewed-week',
			label: `Week ${isoWeekNumber(viewedWeekStart)}`,
			range: { from: viewedWeekStart, to: getSundayOfWeek(viewedWeekStart) }
		});
	}
	presets.push(
		{ key: 'this-week', label: 'This week', range: { from: thisWeekStart, to: getSundayOfWeek(thisWeekStart) } },
		{
			key: 'this-month',
			label: 'This month',
			range: { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}` }
		},
		{ key: 'this-year', label: 'This year', range: { from: `${year}-01-01`, to: `${year}-12-31` } }
	);
	return presets;
}

/** The preset the range is exactly, if any (its button shows as selected) */
export function matchingPresetKey(range: DateRange, presets: RangePreset[]): string | null {
	return presets.find((preset) => preset.range.from === range.from && preset.range.to === range.to)?.key ?? null;
}

/** The range in words for the result line: `2026-11-02 to 2026-11-08`, `all time`, `from 2026-11-02` */
export function describeRange(range: DateRange): string {
	if (!range.from && !range.to) return 'all time';
	if (!range.to) return `from ${range.from}`;
	if (!range.from) return `up to ${range.to}`;
	return `${range.from} to ${range.to}`;
}

/** Active contracts first, then inactive, each keeping the server's order */
export function orderContractsForPicker(contracts: ContractOption[]): { active: ContractOption[]; inactive: ContractOption[] } {
	return {
		active: contracts.filter((contract) => contract.isActive),
		inactive: contracts.filter((contract) => !contract.isActive)
	};
}

export type TotalDisplay =
	| { kind: 'no-contracts' }
	| { kind: 'bad-range' }
	| { kind: 'loading' }
	| { kind: 'offline' }
	| { kind: 'error' }
	| { kind: 'empty' }
	| { kind: 'total'; result: TotalTimeResult };

/** What the result area shows; a stale reply is never shown as the current total */
export function totalDisplay(state: {
	selectedCount: number;
	range: DateRange;
	isLoading: boolean;
	failure: 'offline' | 'error' | null;
	result: TotalTimeResult | null;
}): TotalDisplay {
	if (state.selectedCount === 0) return { kind: 'no-contracts' };
	if (state.range.from && state.range.to && state.range.from > state.range.to) return { kind: 'bad-range' };
	if (state.isLoading || (!state.result && !state.failure)) return { kind: 'loading' };
	if (state.failure) return { kind: state.failure };
	if (!state.result || state.result.totalMinutes === 0) return { kind: 'empty' };
	return { kind: 'total', result: state.result };
}

/** Offline, or the online-only guard's error (`NotAvailableOfflineError`) */
export function isConnectionFailure(error: unknown, isOffline: boolean): boolean {
	if (isOffline) return true;
	if (!(error instanceof Error)) return false;
	return error.name === 'NotAvailableOfflineError' || error.name === 'TypeError';
}
