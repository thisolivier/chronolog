import { json } from '@sveltejs/kit';
import { getWeeklySummary } from '$lib/server/db/queries/time-entries-weekly';
import { getWeeklyStatus } from '$lib/server/db/queries/weekly-statuses';
import { getIsoWeekNumber, getIsoYear } from '$lib/utils/iso-week';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Parse weeks parameter: comma-separated list of Monday dates (YYYY-MM-DD)
	const weeksParam = url.searchParams.get('weeks');
	if (!weeksParam) {
		return json({ error: 'Missing weeks parameter' }, { status: 400 });
	}

	const weekStarts = weeksParam.split(',').map((week) => week.trim());

	// Fetch all weeks in parallel
	const weekSummaries = await Promise.all(
		weekStarts.map(async (weekStart) => {
			const summary = await getWeeklySummary(currentUser.id, weekStart);
			const year = getIsoYear(weekStart);
			const weekNumber = getIsoWeekNumber(weekStart);
			const status = await getWeeklyStatus(currentUser.id, year, weekNumber);

			return {
				...summary,
				status: status?.status ?? 'Unsubmitted'
			};
		})
	);

	return json({ weeks: weekSummaries });
};
