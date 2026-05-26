import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getJWKS } from '$lib/server/powersync-auth';

/**
 * GET /api/auth/powersync/jwks
 *
 * Returns the JWKS (JSON Web Key Set) containing the public key used
 * to verify PowerSync JWT tokens. No authentication required -- the
 * PowerSync service calls this endpoint directly.
 */
export const GET: RequestHandler = async () => {
	const jwks = await getJWKS();

	return json(jwks, {
		headers: {
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
