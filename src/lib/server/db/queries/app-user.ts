import { eq } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { users } from '$lib/server/db/schema/users';
import { clients } from '$lib/server/db/schema/clients';
import { contracts } from '$lib/server/db/schema/contracts';
import { encryptText } from '$lib/server/crypto/server-cipher';

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
export async function ensureAppUser(authUser: { id: string; email: string; name: string }): Promise<void> {
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
					name: encryptText('Internal'),
					shortCode: 'INTL'
				})
				.returning({ id: clients.id });

			await database.insert(contracts).values({
				clientId: internalClient.id,
				name: encryptText('General')
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
