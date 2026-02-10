import { json } from '@sveltejs/kit';
import { createTimeEntry } from '$lib/server/db/queries/time-entries';
import type { RequestHandler } from './$types';

/** POST: Create a manual time entry */
export const POST: RequestHandler = async ({ request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const { date, durationMinutes, contractId, description, startTime, endTime } = body;

	if (!date || durationMinutes === undefined || !contractId) {
		return json(
			{ error: 'Missing required fields: date, durationMinutes, contractId' },
			{ status: 400 }
		);
	}

	const entry = await createTimeEntry({
		userId: currentUser.id,
		contractId,
		date,
		durationMinutes: Number(durationMinutes),
		description: description || null,
		startTime: startTime || null,
		endTime: endTime || null,
		isDraft: false
	});

	return json({ success: true, entry }, { status: 201 });
};
