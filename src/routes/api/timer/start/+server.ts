import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { startTimer, getRunningTimer } from '$lib/server/db/queries/time-entries';
import { readLocalDate, readLocalTime } from '../local-clock';
import { readJsonObject } from '$lib/server/api-request';
import { checkContractAccess } from '../../time-entries/entry-input';

export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	// Check if there's already a running timer
	const existingTimer = await getRunningTimer(currentUser.id);
	if (existingTimer) {
		throw error(409, 'A timer is already running. Stop it before starting a new one.');
	}

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const body = parsedBody.body;
	const contractId = body.contractId;

	if (!contractId || typeof contractId !== 'string') {
		throw error(400, 'contractId is required to start a timer');
	}
	const accessProblem = await checkContractAccess(currentUser.id, contractId);
	if (accessProblem) return accessProblem;

	const timerEntry = await startTimer(currentUser.id, contractId, {
		date: readLocalDate(body.date),
		startTime: readLocalTime(body.startTime)
	});
	return json(timerEntry, { status: 201 });
};
