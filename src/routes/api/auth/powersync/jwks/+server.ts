import { json } from '@sveltejs/kit';
import { getJWKS } from '$lib/server/powersync-auth';
import type { RequestHandler } from './$types';

/**
 * JWKS (JSON Web Key Set) endpoint for PowerSync.
 *
 * PowerSync fetches this endpoint to obtain the public key used to verify
 * JWTs issued by the token endpoint. This must be publicly accessible
 * (no authentication required) since the PowerSync service calls it directly.
 */
export const GET: RequestHandler = async () => {
	const jsonWebKeySet = await getJWKS();

	return json(jsonWebKeySet, {
		headers: {
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
