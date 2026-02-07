import { json } from '@sveltejs/kit';
import { getWeeklyTotals } from '$lib/server/db/queries/time-entries-weekly';
import { getWeeklyStatus } from '$lib/server/db/queries/weekly-statuses';
import { getMondayOfWeek, getIsoWeekNumber, getIsoYear } from '$lib/utils/iso-week';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	// Parse query parameters
	const countParam = url.searchParams.get('count');
	const beforeParam = url.searchParams.get('before');

	const count = countParam ? parseInt(countParam, 10) : 12;
	const before = beforeParam || new Date().toISOString().split('T')[0];

	// Validate parameters
	if (isNaN(count) || count < 1 || count > 52) {
		return json({ error: 'Invalid count parameter (must be 1-52)' }, { status: 400 });
	}

	// Calculate the list of week starts going backwards from 'before'
	const weekStarts: string[] = [];
	const beforeMonday = getMondayOfWeek(before);

	for (let weekOffset = 0; weekOffset < count; weekOffset++) {
		const weekDate = new Date(beforeMonday);
		weekDate.setDate(weekDate.getDate() - (weekOffset * 7));
		const weekStart = weekDate.toISOString().split('T')[0];
		weekStarts.push(weekStart);
	}

	// Get total minutes for all weeks in one query
	const weeklyTotals = await getWeeklyTotals(userId, weekStarts);

	// Build the response array
	const weeks = await Promise.all(
		weekStarts.map(async (weekStart) => {
			const year = getIsoYear(weekStart);
			const weekNumber = getIsoWeekNumber(weekStart);
			const totalMinutes = weeklyTotals.get(weekStart) ?? 0;

			// Get weekly status
			const statusRecord = await getWeeklyStatus(userId, year, weekNumber);
			const status = statusRecord?.status ?? 'Unsubmitted';

			return {
				weekStart,
				year,
				weekNumber,
				totalMinutes,
				status
			};
		})
	);

	return json({ weeks });
};
