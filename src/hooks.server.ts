import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { json, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { getServerEnvironment } from '$lib/server/env';
import { ensureAppUser } from '$lib/server/db/queries/app-user';
import { enforceDeviceGate, isGateExemptPath } from '$lib/server/device-gate/gate';

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

export const handle: Handle = async ({ event, resolve }) => {
	// Device access gate first: an unauthorised request never reaches the session lookup or DB.
	const gateResponse = enforceDeviceGate(event);
	if (gateResponse) return gateResponse;

	// Gate-exempt paths (/unlock, its assets, the PWA manifest and SW) need no session:
	// skip the lookup so a device that has not unlocked never causes a database query.
	if (isGateExemptPath(event.url.pathname)) return resolve(event);

	// Populate session and user on event.locals for all requests.
	// A throwing getSession (e.g. database unreachable, malformed cookie) is
	// treated as "no session" rather than crashing the request.
	let sessionData: Awaited<ReturnType<typeof auth.api.getSession>> = null;
	try {
		sessionData = await auth.api.getSession({
			headers: event.request.headers
		});
	} catch (sessionError) {
		console.error(`Failed to read session for ${event.url.pathname}:`, sessionError);
	}

	if (sessionData) {
		event.locals.session = sessionData.session;
		event.locals.user = sessionData.user;

		// Ensure the authenticated user has a record in the app users table
		await ensureAppUser(sessionData.user);
	}

	// Auth guard: API callers get a 401 JSON body; page requests redirect to login
	if (!sessionData && !isPublicRoute(event.url.pathname)) {
		if (isApiRoute(event.url.pathname)) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		throw redirect(303, '/login');
	}

	// Let Better Auth handle its own API routes
	return svelteKitHandler({ event, resolve, auth, building });
};
