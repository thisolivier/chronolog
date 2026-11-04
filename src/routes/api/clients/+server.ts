import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient, listClientsForUser, nextClientColorIndex } from '$lib/server/db/queries/clients';
import { isUniqueViolation } from '$lib/server/admin-actions';
import { readJsonObject } from '$lib/server/api-request';
import { apiError } from '$lib/server/api-errors';
import { CLIENT_COLORS, isValidClientColorIndex } from '$lib/utils/client-colors';
import {
	clientJson,
	duplicateShortCode,
	firstProblem,
	readClearableText,
	readRequiredText,
	unauthorized,
	wantsArchived
} from '../admin-input';

/**
 * GET /api/clients[?includeArchived=true]
 *
 * The user's clients, ordered by name. Archived clients only with `includeArchived=true`; the
 * system "Deleted Client" never.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const currentUser = locals.user;
	if (!currentUser) return unauthorized();

	const clientList = await listClientsForUser(currentUser.id, { includeArchived: wantsArchived(url) });
	return json({ clients: clientList.map(clientJson) });
};

/**
 * POST /api/clients — body `{ name, shortCode, emoji?, colorIndex? }` (sprint 031-CL).
 * `colorIndex` defaults to the first palette colour no client uses, as the admin form suggests.
 * A short code already in use is 409 `duplicate` with the admin page's message.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const currentUser = locals.user;
	if (!currentUser) return unauthorized();

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const { body } = parsedBody;

	const bothMessage = 'Enter both a name and a short code for the client.';
	const name = readRequiredText(body, 'name', bothMessage);
	const shortCode = readRequiredText(body, 'shortCode', bothMessage);
	const emoji = readClearableText(body, 'emoji');
	const problem = firstProblem(name, shortCode, emoji);
	if (problem) return problem;

	let colorIndex: number;
	if (body.colorIndex === undefined || body.colorIndex === null) {
		colorIndex = await nextClientColorIndex(currentUser.id);
	} else if (isValidClientColorIndex(body.colorIndex)) {
		colorIndex = body.colorIndex;
	} else {
		return apiError(400, `colorIndex must be an integer between 0 and ${CLIENT_COLORS.length - 1}`, 'invalid_input');
	}

	try {
		const client = await createClient(currentUser.id, name as string, shortCode as string, emoji as string | null | undefined, colorIndex);
		return json({ client: clientJson(client), message: `Client “${client.name}” created.` }, { status: 201 });
	} catch (databaseError) {
		if (isUniqueViolation(databaseError)) return duplicateShortCode(shortCode as string);
		throw databaseError;
	}
};
