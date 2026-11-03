import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateClient, type ClientUpdateData } from '$lib/server/db/queries/clients';
import { isValidClientColorIndex, CLIENT_COLORS } from '$lib/utils/client-colors';
import { isUniqueViolation } from '$lib/server/admin-actions';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/clients/:id
 *
 * Partial update of a client. Body: `{ colorIndex?, name?, shortCode?, emoji? }`.
 * `colorIndex` must be an integer palette index (0..7); `emoji` may be `null` to clear it.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id } = params;
	if (!id || !UUID_PATTERN.test(id)) {
		return json({ error: 'Invalid client ID' }, { status: 400 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}
	if (body === null || typeof body !== 'object' || Array.isArray(body)) {
		return json({ error: 'Body must be a JSON object' }, { status: 400 });
	}

	const updateData: ClientUpdateData = {};

	if (body.colorIndex !== undefined) {
		if (!isValidClientColorIndex(body.colorIndex)) {
			return json(
				{ error: `colorIndex must be an integer between 0 and ${CLIENT_COLORS.length - 1}` },
				{ status: 400 }
			);
		}
		updateData.colorIndex = body.colorIndex;
	}

	if (body.name !== undefined) {
		if (typeof body.name !== 'string' || body.name.trim() === '') {
			return json({ error: 'name must be a non-empty string' }, { status: 400 });
		}
		updateData.name = body.name.trim();
	}

	if (body.shortCode !== undefined) {
		if (typeof body.shortCode !== 'string' || body.shortCode.trim() === '') {
			return json({ error: 'shortCode must be a non-empty string' }, { status: 400 });
		}
		updateData.shortCode = body.shortCode.trim();
	}

	if (body.emoji !== undefined) {
		if (body.emoji !== null && typeof body.emoji !== 'string') {
			return json({ error: 'emoji must be a string or null' }, { status: 400 });
		}
		updateData.emoji = body.emoji === null || body.emoji.trim() === '' ? null : body.emoji.trim();
	}

	if (Object.keys(updateData).length === 0) {
		return json({ error: 'No fields to update' }, { status: 400 });
	}

	let updatedClient;
	try {
		updatedClient = await updateClient(id, currentUser.id, updateData);
	} catch (databaseError: unknown) {
		if (isUniqueViolation(databaseError)) {
			return json({ error: 'A client with this short code already exists' }, { status: 400 });
		}
		throw databaseError;
	}

	if (!updatedClient) {
		return json({ error: 'Client not found' }, { status: 404 });
	}

	return json({
		client: {
			id: updatedClient.id,
			name: updatedClient.name,
			shortCode: updatedClient.shortCode,
			emoji: updatedClient.emoji,
			colorIndex: updatedClient.colorIndex
		}
	});
};
