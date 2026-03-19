import { json, error } from '@sveltejs/kit';
import { createTimeEntry } from '$lib/server/db/queries/time-entries';
import type { RequestHandler } from './$types';

/** POST: Create a manual time entry */
export const POST: RequestHandler = async ({ request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const body = await request.json();
	const { date, durationMinutes, contractId, description, startTime, endTime } = body;

	if (!date || durationMinutes === undefined || !contractId) {
		throw error(400, 'Missing required fields: date, durationMinutes, contractId');
	}

	const parsedDuration = Number(durationMinutes);
	if (!Number.isFinite(parsedDuration)) {
		throw error(400, 'durationMinutes must be a finite number');
	}
	if (parsedDuration <= 0) {
		throw error(400, 'durationMinutes must be positive');
	}
	if (parsedDuration > 1440) {
		throw error(400, 'durationMinutes must not exceed 1440 (24 hours)');
	}

	const entry = await createTimeEntry({
		userId: currentUser.id,
		contractId,
		date,
		durationMinutes: parsedDuration,
		description: description || null,
		startTime: startTime || null,
		endTime: endTime || null,
		isDraft: false
	});

	return json({ success: true, entry }, { status: 201 });
};
