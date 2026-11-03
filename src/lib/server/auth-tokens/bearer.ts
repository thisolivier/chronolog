/**
 * Bearer-token authentication for `/api/*`, called from `hooks.server.ts` after the device
 * gate. Sets `locals.user` (and `locals.session = null`) exactly as a session would, or returns
 * the error response: 401 `invalid_token`, 403 `token_revoked`, 429 `rate_limited`.
 *
 * Failed attempts (bad tokens here, failed sign-ins and 2FA checks in the hook) share one
 * per-IP limiter: 60 failures per minute, then 429 on the auth paths.
 */

import type { RequestEvent } from '@sveltejs/kit';
import { apiError } from '$lib/server/api-errors';
import { ensureAppUser } from '$lib/server/db/queries/app-user';
import { createFailureLimiter } from './failure-limiter';
import { getAuthUserById, resolveApiToken } from './token-store';

export const authFailureLimiter = createFailureLimiter(60, 60_000);

/** Better Auth paths whose failures count towards the limiter (password and 2FA guesses). */
const LIMITED_AUTH_PATH_PREFIXES = ['/api/auth/sign-in', '/api/auth/two-factor/'];

export function isLimitedAuthPath(pathname: string): boolean {
	return LIMITED_AUTH_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function rateLimitedResponse(): Response {
	return apiError(429, 'Too many failed authentication attempts; wait a minute and try again', 'rate_limited');
}

/** Returns null when the token authenticated the request, or the response that ends it. */
export async function authenticateBearer(
	event: RequestEvent,
	rawToken: string,
	clientIp: string
): Promise<Response | null> {
	if (authFailureLimiter.isLimited(clientIp)) return rateLimitedResponse();

	let resolution: Awaited<ReturnType<typeof resolveApiToken>>;
	try {
		resolution = await resolveApiToken(rawToken);
	} catch (lookupError) {
		console.error('[api-token] lookup failed:', lookupError);
		return apiError(503, 'Could not check the API token; try again', 'unavailable');
	}

	if (resolution.kind === 'invalid') {
		authFailureLimiter.recordFailure(clientIp);
		console.warn(`[api-token] invalid token ip=${clientIp} path=${event.url.pathname}`);
		return apiError(401, 'Invalid API token', 'invalid_token');
	}
	if (resolution.kind === 'revoked') {
		authFailureLimiter.recordFailure(clientIp);
		console.warn(`[api-token] revoked token used id=${resolution.tokenId} ip=${clientIp}`);
		return apiError(403, 'This API token has been revoked; create a new one in Settings', 'token_revoked');
	}

	const authUser = await getAuthUserById(resolution.userId);
	if (!authUser) return apiError(401, 'Invalid API token', 'invalid_token');

	event.locals.user = authUser;
	event.locals.session = null;
	await ensureAppUser(authUser);
	return null;
}
