import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generatePowerSyncToken } from '$lib/server/powersync-auth';

/**
 * GET & POST /api/auth/powersync/token
 *
 * Returns a signed JWT for the PowerSync client connection.
 * Requires authentication (checked via locals.user).
 */
const handleTokenRequest: RequestHandler = async ({ locals }) => {
	const currentUser = locals.user;
	if (!currentUser) throw error(401, 'Unauthorized');

	const { token, expiresAt } = await generatePowerSyncToken();

	return json({ token, expiresAt });
};

export const GET = handleTokenRequest;
export const POST = handleTokenRequest;
