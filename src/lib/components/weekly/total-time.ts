/**
 * Pure helpers for TotalTimeModal (sprint 065-TT, layout r1 in 066-TR): the quick date ranges,
 * which one the current range matches, the contract list order and the result's display state.
 */
import { getMondayOfWeek, getSundayOfWeek, isoWeekNumber } from '$lib/utils/iso-week';
import type { ContractsByClientResult, TotalTimeResult } from '$lib/services/types';

/** Inclusive bounds as the date inputs hold them: `''` is open-ended */
export type DateRange = { from: string; to: string };

export type RangePreset = { key: string; label: string; range: DateRange };

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

function lastDayOfMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The quick choices in the approved order (Total time r1, TT-02): This week, This month, This year,
 * All time. The viewed week ("Week 44") leads when it is not the current week, since the modal
 * opens on it from an older week (it would repeat "This week" otherwise).
 */
export function rangePresets(todayDate: string, viewedWeekStart: string): RangePreset[] {
	const [year, month] = todayDate.split('-').map(Number);
	const thisWeekStart = getMondayOfWeek(todayDate);
	const presets: RangePreset[] = [];
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
		{ key: 'this-year', label: 'This year', range: { from: `${year}-01-01`, to: `${year}-12-31` } },
		{ key: 'all-time', label: 'All time', range: { from: '', to: '' } }
	);
	return presets;
}

/** The preset the range is exactly, if any (its button shows as selected) */
export function matchingPresetKey(range: DateRange, presets: RangePreset[]): string | null {
	return presets.find((preset) => preset.range.from === range.from && preset.range.to === range.to)?.key ?? null;
}

/** From after To (both set): the result shows no total and both fields are marked (TT-12) */
export function isRangeBackwards(range: DateRange): boolean {
	return Boolean(range.from && range.to && range.from > range.to);
}

/** "1 selected" style count of ticked contract IDs, contracts without time included (TT-09) */
export function selectedCountLabel(selectedCount: number): string {
	return `${selectedCount} selected`;
}

/** The client colour slot of each listed contract, for the breakdown rows' pattern marks */
export function colorIndexByContract(contracts: Pick<PickerContract, 'id' | 'clientColorIndex'>[]): Map<string, number> {
	return new Map(contracts.map((contract) => [contract.id, contract.clientColorIndex]));
}

/** The contracts the modal lists (`GET /api/contracts-by-client?includeArchived=true`) */
export type PickerContract = Pick<
	ContractsByClientResult,
	'id' | 'name' | 'isActive' | 'clientId' | 'clientName' | 'clientShortCode' | 'clientColorIndex' | 'clientSortOrder' | 'archived' | 'clientArchived' | 'system'
>;

export type ContractStatus = 'inactive' | 'archived' | 'deleted';

/** "deleted" (the system Deleted Contract), "archived" (contract or client), "inactive", or null in normal use */
export function contractStatusLabel(contract: PickerContract): ContractStatus | null {
	if (contract.system) return 'deleted';
	if (contract.archived || contract.clientArchived) return 'archived';
	return contract.isActive ? null : 'inactive';
}

/** Contracts in use first; inactive, archived and deleted ones behind the disclosure; server order kept */
export function orderContractsForPicker(contracts: PickerContract[]): { shown: PickerContract[]; hidden: PickerContract[] } {
	return {
		shown: contracts.filter((contract) => contractStatusLabel(contract) === null),
		hidden: contracts.filter((contract) => contractStatusLabel(contract) !== null)
	};
}

/** The disclosure names the kinds it holds: "Show inactive", "Show inactive, archived and deleted (3)" */
export function hiddenToggleLabel(hidden: PickerContract[]): string {
	const kinds = (['inactive', 'archived', 'deleted'] as const).filter((kind) => hidden.some((contract) => contractStatusLabel(contract) === kind));
	const words = kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}` : (kinds[0] ?? '');
	return `Show ${words} (${hidden.length})`;
}

/**
 * Always the ticked contracts' IDs (the system Deleted Contract is listed like any other), so
 * unticking one contract takes off exactly its minutes; none ticked is an empty list.
 */
export function contractsForRequest(listedContractIds: string[], selectedContractIds: ReadonlySet<string>): string[] {
	return listedContractIds.filter((contractId) => selectedContractIds.has(contractId));
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
	if (isRangeBackwards(state.range)) return { kind: 'bad-range' };
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
