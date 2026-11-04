import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getClientForUser,
	setClientArchived,
	updateClient,
	type ClientUpdateData
} from '$lib/server/db/queries/clients';
import { deleteClientWithReassignment, getClientUsage } from '$lib/server/db/queries/safe-deletion';
import { archiveMessage, deletionMessage, isUniqueViolation } from '$lib/server/admin-actions';
import { readJsonObject } from '$lib/server/api-request';
import { apiError } from '$lib/server/api-errors';
import { isValidClientColorIndex, CLIENT_COLORS } from '$lib/utils/client-colors';
import {
	clientJson,
	duplicateShortCode,
	firstProblem,
	notFound,
	readClearableText,
	readId,
	readOptionalBoolean,
	readOptionalText,
	unauthorized
} from '../../admin-input';

/**
 * GET /api/clients/:id — one of the user’s clients, archived or not, with `usage` (entries,
 * minutes and notes a delete would move), as the admin delete dialog shows.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return unauthorized();
	const clientId = readId(params.id, 'client');
	if (clientId instanceof Response) return clientId;

	const client = await getClientForUser(clientId, locals.user.id);
	if (!client) return notFound('client');
	const usage = await getClientUsage(clientId, locals.user.id);
	return json({ client: clientJson(client), usage });
};

/**
 * PATCH /api/clients/:id
 *
 * Partial update. Body: `{ name?, shortCode?, emoji?, colorIndex?, archived? }`. `colorIndex`
 * is a palette index (0..7); `emoji` may be `null` to clear it; `archived: true|false` archives
 * or restores (sprint 031-CL). A short code already in use is 409 `duplicate`.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return unauthorized();
	const clientId = readId(params.id, 'client');
	if (clientId instanceof Response) return clientId;

	const parsedBody = await readJsonObject(request);
	if (!parsedBody.ok) return parsedBody.response;
	const { body } = parsedBody;

	const name = readOptionalText(body, 'name', 'name must be a non-empty string');
	const shortCode = readOptionalText(body, 'shortCode', 'shortCode must be a non-empty string');
	const emoji = readClearableText(body, 'emoji');
	const archived = readOptionalBoolean(body, 'archived');
	const problem = firstProblem(name, shortCode, emoji, archived);
	if (problem) return problem;

	const updateData: ClientUpdateData = {};
	if (body.colorIndex !== undefined) {
		if (!isValidClientColorIndex(body.colorIndex)) {
			return apiError(400, `colorIndex must be an integer between 0 and ${CLIENT_COLORS.length - 1}`, 'invalid_input');
		}
		updateData.colorIndex = body.colorIndex;
	}
	if (name !== undefined) updateData.name = name as string;
	if (shortCode !== undefined) updateData.shortCode = shortCode as string;
	if (emoji !== undefined) updateData.emoji = emoji as string | null;

	if (Object.keys(updateData).length === 0 && archived === undefined) {
		return apiError(400, 'No fields to update', 'invalid_input');
	}

	const owned = await getClientForUser(clientId, currentUser.id);
	if (!owned) return notFound('client');
	let client = owned;
	const messages: string[] = [];

	if (Object.keys(updateData).length > 0) {
		let updated;
		try {
			updated = await updateClient(clientId, currentUser.id, updateData);
		} catch (databaseError: unknown) {
			if (isUniqueViolation(databaseError)) return duplicateShortCode(updateData.shortCode ?? '');
			throw databaseError;
		}
		if (!updated) return notFound('client');
		client = updated;
		messages.push(`Client “${client.name}” saved.`);
	}
	if (archived !== undefined) {
		const toggled = await setClientArchived(clientId, currentUser.id, archived as boolean);
		if (!toggled) return notFound('client');
		client = toggled;
		messages.push(archiveMessage('client', client.name, archived as boolean));
	}

	return json({ client: clientJson(client), message: messages.join(' ') });
};

/**
 * DELETE /api/clients/:id — the admin page's safe deletion: every time entry and note of every
 * contract moves to the system "Deleted Client / Deleted Contract" (entries note where they came
 * from), then the client and its contracts are deleted, in one transaction. Answers what moved.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) return unauthorized();
	const clientId = readId(params.id, 'client');
	if (clientId instanceof Response) return clientId;

	const client = await getClientForUser(clientId, currentUser.id);
	if (!client) return notFound('client');
	const usage = await getClientUsage(clientId, currentUser.id);

	const result = await deleteClientWithReassignment(clientId, currentUser.id);
	if (!result) return notFound('client');

	return json({
		deleted: { kind: 'client', id: client.id, name: client.name, shortCode: client.shortCode },
		...result,
		minutesMoved: usage.totalMinutes,
		message: deletionMessage(client.name, result, usage.totalMinutes)
	});
};
