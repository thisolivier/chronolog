import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

/**
 * Routes that do not require authentication.
 * All other routes will redirect unauthenticated users to /login.
 */
const publicRoutes = ['/login', '/register', '/api/auth'];

function isPublicRoute(pathname: string): boolean {
	return publicRoutes.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

export const handle: Handle = async ({ event, resolve }) => {
	// Populate session and user on event.locals for all requests
	const sessionData = await auth.api.getSession({
		headers: event.request.headers
	});

	if (sessionData) {
		event.locals.session = sessionData.session;
		event.locals.user = sessionData.user;
	}

	// Auth guard: redirect unauthenticated users to login for protected routes
	if (!sessionData && !isPublicRoute(event.url.pathname)) {
		throw redirect(303, '/login');
	}

	// Let Better Auth handle its own API routes
	return svelteKitHandler({ event, resolve, auth, building });
};
