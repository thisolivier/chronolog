import { json } from '@sveltejs/kit';
import { getWeeklyStatus, upsertWeeklyStatus } from '$lib/server/db/queries/weekly-statuses';
import type { RequestHandler } from './$types';

/** GET: Fetch statuses for multiple weeks */
export const GET: RequestHandler = async ({ url, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Parse weeks parameter: comma-separated list of "year-weekNumber" pairs
	const weeksParam = url.searchParams.get('weeks');
	if (!weeksParam) {
		return json({ error: 'Missing weeks parameter' }, { status: 400 });
	}

	const weekKeys = weeksParam.split(',').map((week) => week.trim());
	const statuses: Record<string, string> = {};

	await Promise.all(
		weekKeys.map(async (weekKey) => {
			const [yearStr, weekNumStr] = weekKey.split('-W');
			const year = parseInt(yearStr, 10);
			const weekNumber = parseInt(weekNumStr, 10);

			const status = await getWeeklyStatus(currentUser.id, year, weekNumber);
			statuses[weekKey] = status?.status ?? 'Unsubmitted';
		})
	);

	return json({ statuses });
};

/** POST: Update status for a specific week */
export const POST: RequestHandler = async ({ request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const { year, weekNumber, status } = body;

	if (!year || !weekNumber || !status) {
		return json({ error: 'Missing required fields: year, weekNumber, status' }, { status: 400 });
	}

	const updated = await upsertWeeklyStatus(
		currentUser.id,
		parseInt(year, 10),
		parseInt(weekNumber, 10),
		status
	);

	return json({ success: true, status: updated });
};
