import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { startTimer, getRunningTimer } from '$lib/server/db/queries/time-entries';

export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	// Check if there's already a running timer
	const existingTimer = await getRunningTimer(currentUser.id);
	if (existingTimer) {
		throw error(409, 'A timer is already running. Stop it before starting a new one.');
	}

	let body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON in request body');
	}
	const contractId = body.contractId;

	if (!contractId) {
		throw error(400, 'contractId is required to start a timer');
	}

	const timerEntry = await startTimer(currentUser.id, contractId);
	return json(timerEntry, { status: 201 });
};
