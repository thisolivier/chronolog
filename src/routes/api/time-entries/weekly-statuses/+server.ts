import { json } from '@sveltejs/kit';
import { getWeeklyStatus, upsertWeeklyStatus } from '$lib/server/db/queries/weekly-statuses';
import { apiError } from '$lib/server/api-errors';
import { readJsonObject } from '$lib/server/api-request';
import { checkWeekKey, checkWeekStatus, checkYearAndWeek } from './week-input';
import type { RequestHandler } from './$types';

const MAX_WEEKS_PER_REQUEST = 60;

/** GET ?weeks=2026-W44,2026-W45: statuses for several weeks (`Unsubmitted` when none is stored). */
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
		parsedWeeks.map(async ({ weekKey, year, weekNumber }) => {
			const status = await getWeeklyStatus(currentUser.id, year, weekNumber);
			statuses[weekKey] = status?.status ?? 'Unsubmitted';
		})
	);

	return json({ statuses });
};

/** POST { year, weekNumber, status }: set one week's status. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return apiError(401, 'Unauthorized');

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const { year, weekNumber, status } = parsedBody.body;

	if (year === undefined || weekNumber === undefined || status === undefined || status === null) {
		return apiError(400, 'Missing required fields: year, weekNumber, status');
	}
	const checkedWeek = checkYearAndWeek(year, weekNumber);
	if (!checkedWeek.ok) return apiError(400, checkedWeek.error, checkedWeek.code);
	const checkedStatus = checkWeekStatus(status);
	if (!checkedStatus.ok) return apiError(400, checkedStatus.error, checkedStatus.code);

	const updated = await upsertWeeklyStatus(
		currentUser.id,
		checkedWeek.value.year,
		checkedWeek.value.weekNumber,
		checkedStatus.value
	);

	return json({ success: true, status: updated });
};
