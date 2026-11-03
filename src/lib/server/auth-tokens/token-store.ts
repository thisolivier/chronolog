/**
 * Database access for personal API tokens: create (returns the raw token once), list,
 * revoke, and the storage used by the bearer resolver.
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import { database } from '$lib/server/db';
import { apiTokens } from '$lib/server/db/schema/api-tokens';
import { user as authUser } from '$lib/server/db/auth-schema';
import { generateApiToken } from './token-format';
import { createTokenResolver, type TokenStorage } from './resolve-token';

export const TOKEN_NAME_MAX_LENGTH = 80;

/** What the settings page and `GET /api/tokens` show: never the hash. */
export interface ApiTokenSummary {
	id: string;
	name: string;
	createdAt: Date;
	lastUsedAt: Date | null;
	revokedAt: Date | null;
}

const summaryColumns = {
	id: apiTokens.id,
	name: apiTokens.name,
	createdAt: apiTokens.createdAt,
	lastUsedAt: apiTokens.lastUsedAt,
	revokedAt: apiTokens.revokedAt
};

export async function createApiToken(
	userId: string,
	name: string
): Promise<{ token: ApiTokenSummary; rawToken: string }> {
	const generated = generateApiToken();
	const [token] = await database
		.insert(apiTokens)
		.values({ id: generated.tokenId, userId, name, tokenHash: generated.secretHash })
		.returning(summaryColumns);
	return { token, rawToken: generated.rawToken };
}

export async function listApiTokens(userId: string): Promise<ApiTokenSummary[]> {
	return database
		.select(summaryColumns)
		.from(apiTokens)
		.where(eq(apiTokens.userId, userId))
		.orderBy(desc(apiTokens.createdAt));
}

/** Revokes an active token; returns false when it does not exist, is not the user's, or is already revoked. */
export async function revokeApiToken(userId: string, tokenId: string): Promise<boolean> {
	const updated = await database
		.update(apiTokens)
		.set({ revokedAt: new Date() })
		.where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
		.returning({ id: apiTokens.id });
	return updated.length > 0;
}

/** The Better Auth user row, shaped like `locals.user` from a session. */
export async function getAuthUserById(userId: string) {
	const rows = await database.select().from(authUser).where(eq(authUser.id, userId)).limit(1);
	return rows[0] ?? null;
}

const databaseTokenStorage: TokenStorage = {
	async findTokenById(tokenId) {
		const rows = await database
			.select({
				id: apiTokens.id,
				userId: apiTokens.userId,
				tokenHash: apiTokens.tokenHash,
				lastUsedAt: apiTokens.lastUsedAt,
				revokedAt: apiTokens.revokedAt
			})
			.from(apiTokens)
			.where(eq(apiTokens.id, tokenId))
			.limit(1);
		return rows[0] ?? null;
	},
	async markTokenUsed(tokenId, usedAt) {
		await database.update(apiTokens).set({ lastUsedAt: usedAt }).where(eq(apiTokens.id, tokenId));
	}
};

export const resolveApiToken = createTokenResolver(databaseTokenStorage);
