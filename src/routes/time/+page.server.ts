import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { deleteTimeEntry } from '$lib/server/db/queries/time-entries';
import { getWeeklySummary } from '$lib/server/db/queries/time-entries-weekly';
import {
	getWeeklyStatus,
	upsertWeeklyStatus
} from '$lib/server/db/queries/weekly-statuses';
import {
	getMondayOfWeek,
	getIsoWeekNumber,
	getIsoYear
} from '$lib/utils/iso-week';

export const load: PageServerLoad = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	// Determine which week to show
	const weekParam = url.searchParams.get('week'); // Expected: YYYY-MM-DD (a Monday)
	const todayString = new Date().toISOString().split('T')[0];
	const weekStart = weekParam || getMondayOfWeek(todayString);

	// Fetch weekly summary (entries grouped by day)
	const weeklySummary = await getWeeklySummary(currentUser.id, weekStart);

	// Fetch weekly status
	const year = getIsoYear(weekStart);
	const weekNumber = getIsoWeekNumber(weekStart);
	const existingStatus = await getWeeklyStatus(currentUser.id, year, weekNumber);
	const weeklyStatus = existingStatus?.status ?? 'Unsubmitted';

	return {
		weeklySummary,
		weekStart,
		weeklyStatus
	};
};

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const formData = await request.formData();
		const entryId = formData.get('entry_id')?.toString();

		if (!entryId) {
			return fail(400, { error: 'Entry ID is required.' });
		}

		const deletedEntry = await deleteTimeEntry(entryId, currentUser.id);
		if (!deletedEntry) {
			return fail(404, { error: 'Time entry not found.' });
		}

		return { success: true };
	},

	updateStatus: async ({ request, locals }) => {
		const currentUser = locals.user;
		if (!currentUser) throw error(401, 'Unauthorized');

		const formData = await request.formData();
		const year = parseInt(formData.get('year')?.toString() ?? '', 10);
		const weekNumber = parseInt(formData.get('week_number')?.toString() ?? '', 10);
		const status = formData.get('status')?.toString();

		if (!year || !weekNumber || !status) {
			return fail(400, { error: 'Year, week number, and status are required.' });
		}

		await upsertWeeklyStatus(currentUser.id, year, weekNumber, status);

		return { statusUpdated: true };
	}
};
