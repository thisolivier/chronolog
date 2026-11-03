import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/api-errors';
import { revokeApiToken } from '$lib/server/auth-tokens/token-store';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DELETE /api/tokens/:tokenId — revoke (session only). The row is kept so the token answers 403. */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) return apiError(401, 'Unauthorized', 'unauthorized');
	if (!locals.session) return apiError(403, 'Manage API tokens from a signed-in browser', 'session_required');
	if (!UUID_PATTERN.test(params.tokenId)) return apiError(404, 'Token not found', 'not_found');

	const revoked = await revokeApiToken(locals.user.id, params.tokenId);
	if (!revoked) return apiError(404, 'Token not found or already revoked', 'not_found');
	return json({ success: true });
};
