import { json } from '@sveltejs/kit';
import { getWeeklyStatusForWeekStart, upsertWeeklyStatus } from '$lib/server/db/queries/weekly-statuses';
import { apiError } from '$lib/server/api-errors';
import { readJsonObject } from '$lib/server/api-request';
import { checkWeekKey, checkWeekStart, checkWeekStatus, checkYearAndWeek } from './week-input';
import type { RequestHandler } from './$types';

const MAX_WEEKS_PER_REQUEST = 60;

/**
 * GET ?weeks=2026-W44,2026-W45: statuses for several weeks (`Unsubmitted` when none is stored).
 * Keys are ISO 8601 weeks (iso-week.ts); each is looked up by its Monday.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return apiError(401, 'Unauthorized');

	const weeksParam = url.searchParams.get('weeks');
	if (!weeksParam) return apiError(400, 'Missing weeks parameter');

	const weekKeys = weeksParam.split(',').map((week) => week.trim());
	if (weekKeys.length > MAX_WEEKS_PER_REQUEST) {
		return apiError(400, `At most ${MAX_WEEKS_PER_REQUEST} weeks per request`, 'invalid_week');
	}
	const parsedWeeks = [];
	for (const weekKey of weekKeys) {
		const checked = checkWeekKey(weekKey);
		if (!checked.ok) return apiError(400, checked.error, checked.code);
		parsedWeeks.push({ weekKey, ...checked.value });
	}

	const statuses: Record<string, string> = {};
	await Promise.all(
		parsedWeeks.map(async ({ weekKey, weekStart }) => {
			const status = await getWeeklyStatusForWeekStart(currentUser.id, weekStart);
			statuses[weekKey] = status?.status ?? 'Unsubmitted';
		})
	);

	return json({ statuses });
};

/**
 * POST { weekStart, status } (the web client, 061-DR) or { year, weekNumber, status } (ISO week; the
 * CLI): set one week's status. `weekStart` wins when both are sent, since the Monday is the key and
 * a number from an older client may follow a different rule. Recordkeeping only: choosing
 * Submitted sends, exports or invoices nothing.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return apiError(401, 'Unauthorized');

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const { year, weekNumber, weekStart, status } = parsedBody.body;

	const hasWeek = weekStart !== undefined || (year !== undefined && weekNumber !== undefined);
	if (!hasWeek || status === undefined || status === null) {
		return apiError(400, 'Missing required fields: year, weekNumber (or weekStart), status');
	}
	const checkedWeek = weekStart !== undefined ? checkWeekStart(weekStart) : checkYearAndWeek(year, weekNumber);
	if (!checkedWeek.ok) return apiError(400, checkedWeek.error, checkedWeek.code);
	const checkedStatus = checkWeekStatus(status);
	if (!checkedStatus.ok) return apiError(400, checkedStatus.error, checkedStatus.code);

	const updated = await upsertWeeklyStatus(currentUser.id, checkedWeek.value.weekStart, checkedStatus.value);

	return json({ success: true, status: updated });
};
