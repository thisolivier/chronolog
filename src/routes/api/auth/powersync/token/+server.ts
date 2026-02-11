import { json, error } from '@sveltejs/kit';
import { generatePowerSyncToken } from '$lib/server/powersync-auth';
import type { RequestHandler } from './$types';

/**
 * Token endpoint for PowerSync authentication.
 *
 * Returns a signed JWT that the PowerSync client SDK uses to authenticate
 * with the PowerSync service. Requires the user to be authenticated via
 * their session (checked via event.locals.user).
 */
export const GET: RequestHandler = async ({ locals }) => {
	const authenticatedUser = locals.user;

	if (!authenticatedUser) {
		throw error(401, 'Authentication required');
	}

	const { token, expiresAt } = await generatePowerSyncToken(authenticatedUser.id);

	return json({ token, expiresAt });
};
