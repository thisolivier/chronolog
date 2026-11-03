/**
 * Validation for the weekly-status route (ported by hand from `fix/weekly-status-input-validation`
 * in sprint 029-CL): year 2000–2100, ISO week 1–53, status one of the UI's week states.
 */

export const WEEK_STATUSES = ['Unsubmitted', 'Draft ready', 'Submitted'] as const;
export type WeekStatus = (typeof WEEK_STATUSES)[number];

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

type Checked<Value> = { ok: true; value: Value } | { ok: false; error: string; code: string };

/** An integer from a number or a digits-only string; NaN otherwise. */
function toInteger(value: unknown): number {
	if (typeof value === 'number') return Number.isInteger(value) ? value : Number.NaN;
	if (typeof value === 'string' && /^\s*\d+\s*$/.test(value)) return Number.parseInt(value, 10);
	return Number.NaN;
}

export function checkYearAndWeek(
	rawYear: unknown,
	rawWeekNumber: unknown
): Checked<{ year: number; weekNumber: number }> {
	const year = toInteger(rawYear);
	if (!(year >= MIN_YEAR && year <= MAX_YEAR)) {
		return { ok: false, error: `year must be a number between ${MIN_YEAR} and ${MAX_YEAR}`, code: 'invalid_week' };
	}
	const weekNumber = toInteger(rawWeekNumber);
	if (!(weekNumber >= 1 && weekNumber <= 53)) {
		return { ok: false, error: 'weekNumber must be between 1 and 53', code: 'invalid_week' };
	}
	return { ok: true, value: { year, weekNumber } };
}

/** `2026-W45` keys from the GET `weeks` parameter. */
export function checkWeekKey(weekKey: string): Checked<{ year: number; weekNumber: number }> {
	const [yearText, weekText] = weekKey.split('-W');
	if (weekText === undefined) {
		return { ok: false, error: `week “${weekKey}” must look like 2026-W45`, code: 'invalid_week' };
	}
	return checkYearAndWeek(yearText, weekText);
}

export function checkWeekStatus(rawStatus: unknown): Checked<WeekStatus> {
	const status = typeof rawStatus === 'string' ? rawStatus.trim() : '';
	if (!status) return { ok: false, error: 'status must be a non-empty string', code: 'invalid_status' };
	if (!(WEEK_STATUSES as readonly string[]).includes(status)) {
		return { ok: false, error: `status must be one of: ${WEEK_STATUSES.join(', ')}`, code: 'invalid_status' };
	}
	return { ok: true, value: status as WeekStatus };
}
