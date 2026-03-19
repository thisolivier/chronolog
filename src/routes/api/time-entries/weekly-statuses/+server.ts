import { json, error } from '@sveltejs/kit';
import { getWeeklyStatus, upsertWeeklyStatus } from '$lib/server/db/queries/weekly-statuses';
import type { RequestHandler } from './$types';

function validateYearAndWeek(year: number, weekNumber: number): void {
	if (isNaN(year) || year < 2000 || year > 2100) {
		throw error(400, 'year must be a 4-digit number between 2000 and 2100');
	}
	if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 53) {
		throw error(400, 'weekNumber must be between 1 and 53');
	}
}

/** GET: Fetch statuses for multiple weeks */
export const GET: RequestHandler = async ({ url, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	// Parse weeks parameter: comma-separated list of "year-weekNumber" pairs
	const weeksParam = url.searchParams.get('weeks');
	if (!weeksParam) {
		throw error(400, 'Missing weeks parameter');
	}

	const weekKeys = weeksParam.split(',').map((week) => week.trim());
	const statuses: Record<string, string> = {};

	await Promise.all(
		weekKeys.map(async (weekKey) => {
			const [yearStr, weekNumStr] = weekKey.split('-W');
			const year = parseInt(yearStr, 10);
			const weekNumber = parseInt(weekNumStr, 10);

			validateYearAndWeek(year, weekNumber);

			const status = await getWeeklyStatus(currentUser.id, year, weekNumber);
			statuses[weekKey] = status?.status ?? 'Unsubmitted';
		})
	);

	return json({ statuses });
};

/** POST: Update status for a specific week */
export const POST: RequestHandler = async ({ request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const body = await request.json();
	const { year, weekNumber, status } = body;

	if (!year || !weekNumber || status === undefined || status === null) {
		throw error(400, 'Missing required fields: year, weekNumber, status');
	}

	const parsedYear = parseInt(year, 10);
	const parsedWeekNumber = parseInt(weekNumber, 10);
	validateYearAndWeek(parsedYear, parsedWeekNumber);

	const trimmedStatus = typeof status === 'string' ? status.trim() : '';
	if (!trimmedStatus) {
		throw error(400, 'status must be a non-empty string');
	}

	const updated = await upsertWeeklyStatus(
		currentUser.id,
		parsedYear,
		parsedWeekNumber,
		trimmedStatus
	);

	return json({ success: true, status: updated });
};
