import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { getServerEnvironment } from '$lib/server/env';
import { ensureAppUser } from '$lib/server/db/queries/app-user';
import { clientIpAddress, enforceDeviceGate, isGateExemptPath } from '$lib/server/device-gate/gate';
import { apiError, normalizeApiErrorResponse } from '$lib/server/api-errors';
import { readBearerToken } from '$lib/server/auth-tokens/token-format';
import {
	authFailureLimiter,
	authenticateBearer,
	isLimitedAuthPath,
	rateLimitedResponse
} from '$lib/server/auth-tokens/bearer';

// Fail fast at server boot when required secrets are missing (no-op during build).
const serverEnvironment = getServerEnvironment();
if (!building && serverEnvironment.deviceAccessKeyHash === null) {
	console.warn(
		'\n[device-gate] ************************************************************\n' +
			'[device-gate] WARNING: DEVICE_ACCESS_KEY_HASH is not set — the device access gate is\n' +
			'[device-gate] DISABLED. Anyone who can reach this server sees the login page.\n' +
			'[device-gate] Generate one with: node scripts/generate-device-key.mjs\n' +
			'[device-gate] ************************************************************\n'
	);
}

/**
 * Routes that do not require a login session (they still sit behind the device gate).
 * Unauthenticated page requests elsewhere redirect to /login; API requests get a 401.
 */
const publicRoutes = ['/login', '/register', '/api/auth'];

function isPublicRoute(pathname: string): boolean {
	return publicRoutes.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

function isApiRoute(pathname: string): boolean {
	return pathname === '/api' || pathname.startsWith('/api/');
}

function isBetterAuthRoute(pathname: string): boolean {
	return pathname === '/api/auth' || pathname.startsWith('/api/auth/');
}

/** App API routes (not Better Auth's) answer errors as `{ error, code, message }`. */
async function finishApiResponse(pathname: string, response: Response): Promise<Response> {
	return isApiRoute(pathname) && !isBetterAuthRoute(pathname) ? normalizeApiErrorResponse(response) : response;
}

export const handle: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;

	// Device access gate first: an unauthorised request never reaches the session lookup or DB.
	const gateResponse = enforceDeviceGate(event);
	if (gateResponse) {
		if (!isApiRoute(pathname)) return gateResponse;
		return gateResponse.status === 429
			? apiError(429, 'Too many failed device key attempts; try again later', 'device_locked')
			: apiError(gateResponse.status, 'Device not authorised', 'device_not_authorised');
	}

	// Gate-exempt paths (/unlock, its assets, the PWA manifest and SW) need no session:
	// skip the lookup so a device that has not unlocked never causes a database query.
	if (isGateExemptPath(pathname)) return resolve(event);

	const clientIp = clientIpAddress(event);

	// Personal API token (sprint 028-CL): `Authorization: Bearer clg_…` on app API routes
	// resolves to the token's user exactly like a session, without a cookie lookup.
	const bearerToken = readBearerToken(event.request.headers.get('authorization'));
	if (bearerToken !== null && isApiRoute(pathname) && !isBetterAuthRoute(pathname)) {
		const bearerFailure = await authenticateBearer(event, bearerToken, clientIp);
		if (bearerFailure) return bearerFailure;
		return finishApiResponse(pathname, await resolve(event));
	}

	// Password and 2FA guesses share the per-IP failure limit with bad tokens.
	const isLimitedAuthRequest = isLimitedAuthPath(pathname);
	if (isLimitedAuthRequest && authFailureLimiter.isLimited(clientIp)) return rateLimitedResponse();

	// Populate session and user on event.locals for all requests.
	// A throwing getSession (e.g. database unreachable, malformed cookie) is
	// treated as "no session" rather than crashing the request.
	let sessionData: Awaited<ReturnType<typeof auth.api.getSession>> = null;
	try {
		sessionData = await auth.api.getSession({
			headers: event.request.headers
		});
	} catch (sessionError) {
		console.error(`Failed to read session for ${pathname}:`, sessionError);
	}

	if (sessionData) {
		event.locals.session = sessionData.session;
		event.locals.user = sessionData.user;

		// Ensure the authenticated user has a record in the app users table
		await ensureAppUser(sessionData.user);
	}

	// Auth guard: API callers get a 401 JSON body; page requests redirect to login
	if (!sessionData && !isPublicRoute(pathname)) {
		if (isApiRoute(pathname)) {
			return apiError(401, 'Unauthorized: sign in or send an API token', 'unauthorized');
		}
		throw redirect(303, '/login');
	}

	// Let Better Auth handle its own API routes
	const response = await svelteKitHandler({ event, resolve, auth, building });
	if (isLimitedAuthRequest && (response.status === 401 || response.status === 403)) {
		authFailureLimiter.recordFailure(clientIp);
	}
	return finishApiResponse(pathname, response);
};
