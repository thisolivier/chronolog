import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { database } from '$lib/server/db';
import { users } from '$lib/server/db/schema/users';
import { clients } from '$lib/server/db/schema/clients';
import { contracts } from '$lib/server/db/schema/contracts';
import { eq } from 'drizzle-orm';

/**
 * Routes that do not require authentication.
 * All other routes will redirect unauthenticated users to /login.
 */
const publicRoutes = ['/login', '/register', '/api/auth', '/api/auth/powersync/jwks'];

function isPublicRoute(pathname: string): boolean {
	return publicRoutes.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

/**
 * In-memory cache of user IDs that have been confirmed to exist in the app
 * `users` table. Avoids a DB lookup on every authenticated request.
 * The cache resets when the server restarts, which is acceptable because
 * the DB check is only a fallback — the insert is a one-time operation.
 */
const syncedUserIds = new Set<string>();

/**
 * Ensures the authenticated Better Auth user has a corresponding record in
 * the app `users` table. If not, creates the user and seeds default data
 * (an "Internal" client and a "General" contract).
 *
 * Uses a try/catch so that concurrent requests racing to insert the same
 * user don't crash — a unique constraint violation simply means another
 * request already handled the insert.
 */
async function ensureAppUser(authUser: { id: string; email: string; name: string }): Promise<void> {
	if (syncedUserIds.has(authUser.id)) {
		return;
	}

	try {
		const existingUser = await database
			.select({ id: users.id })
			.from(users)
			.where(eq(users.id, authUser.id))
			.limit(1);

		if (existingUser.length === 0) {
			await database.insert(users).values({
				id: authUser.id,
				email: authUser.email,
				name: authUser.name
			});

			const [internalClient] = await database
				.insert(clients)
				.values({
					userId: authUser.id,
					name: 'Internal',
					shortCode: 'INTL'
				})
				.returning({ id: clients.id });

			await database.insert(contracts).values({
				clientId: internalClient.id,
				name: 'General',
				userId: authUser.id
			});
		}

		syncedUserIds.add(authUser.id);
	} catch (error: unknown) {
		// If the error is a unique constraint violation, another concurrent
		// request already created the user — that's fine, cache it.
		const isUniqueViolation =
			error instanceof Error && 'code' in error && (error as { code: string }).code === '23505';

		if (isUniqueViolation) {
			syncedUserIds.add(authUser.id);
		} else {
			console.error('Failed to sync app user record:', error);
		}
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	// Populate session and user on event.locals for all requests
	const sessionData = await auth.api.getSession({
		headers: event.request.headers
	});

	if (sessionData) {
		event.locals.session = sessionData.session;
		event.locals.user = sessionData.user;

		// Ensure the authenticated user has a record in the app users table
		await ensureAppUser(sessionData.user);
	}

	// Auth guard: redirect unauthenticated users to login for protected routes
	if (!sessionData && !isPublicRoute(event.url.pathname)) {
		throw redirect(303, '/login');
	}

	// Let Better Auth handle its own API routes
	return svelteKitHandler({ event, resolve, auth, building });
};
