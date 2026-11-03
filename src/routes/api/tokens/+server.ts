import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/api-errors';
import { createApiToken, listApiTokens, TOKEN_NAME_MAX_LENGTH } from '$lib/server/auth-tokens/token-store';

/**
 * Personal API tokens (sprint 028-CL). Managing tokens needs a signed-in browser session:
 * a bearer token cannot list, mint or revoke tokens (403 `session_required`).
 *
 * GET  /api/tokens         → { tokens: [{ id, name, createdAt, lastUsedAt, revokedAt }] }
 * POST /api/tokens { name } → 201 { token, rawToken } — the raw token is returned only here.
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return apiError(401, 'Unauthorized', 'unauthorized');
	if (!locals.session) return apiError(403, 'Manage API tokens from a signed-in browser', 'session_required');
	return json({ tokens: await listApiTokens(locals.user.id) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return apiError(401, 'Unauthorized', 'unauthorized');
	if (!locals.session) return apiError(403, 'Manage API tokens from a signed-in browser', 'session_required');

	const body = await request.json().catch(() => null);
	const name = typeof body?.name === 'string' ? body.name.trim() : '';
	if (!name) return apiError(400, 'Give the token a name, e.g. “MacBook CLI”', 'invalid_name');
	if (name.length > TOKEN_NAME_MAX_LENGTH) {
		return apiError(400, `Keep the name under ${TOKEN_NAME_MAX_LENGTH} characters`, 'invalid_name');
	}

	const { token, rawToken } = await createApiToken(locals.user.id, name);
	return json({ token, rawToken }, { status: 201 });
};
