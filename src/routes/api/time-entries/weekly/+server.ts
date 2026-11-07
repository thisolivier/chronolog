import { json } from '@sveltejs/kit';
import { getWeeklySummary } from '$lib/server/db/queries/time-entries-weekly';
import { getWeeklyStatusForWeekStart } from '$lib/server/db/queries/weekly-statuses';
import { mondayOnOrBefore } from '$lib/utils/calendar-week';
import { isCalendarDate } from '$lib/utils/local-calendar';
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
	if (!weekStarts.every(isCalendarDate)) {
		return json({ error: 'weeks must be Monday dates (YYYY-MM-DD)' }, { status: 400 });
	}

	// Fetch all weeks in parallel
	const weekSummaries = await Promise.all(
		weekStarts.map(async (weekStart) => {
			const summary = await getWeeklySummary(currentUser.id, weekStart);
			// A week is identified by its Monday, so no numbering rule can lose a status
			const status = await getWeeklyStatusForWeekStart(currentUser.id, mondayOnOrBefore(weekStart));

			return {
				...summary,
				status: status?.status ?? 'Unsubmitted'
			};
		})
	);

	return json({ weeks: weekSummaries });
};
