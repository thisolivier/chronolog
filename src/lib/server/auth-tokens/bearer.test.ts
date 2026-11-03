import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const resolveApiToken = vi.fn();
const getAuthUserById = vi.fn();
const ensureAppUser = vi.fn();

vi.mock('./token-store', () => ({ resolveApiToken, getAuthUserById }));
vi.mock('$lib/server/db/queries/app-user', () => ({ ensureAppUser }));

const { authenticateBearer, authFailureLimiter } = await import('./bearer');

function fakeEvent(): RequestEvent {
	return { url: new URL('http://localhost/api/clients'), locals: {} } as unknown as RequestEvent;
}

const authUser = { id: 'user-1', email: 'owner@example.test', name: 'Owner' };
let ipCounter = 0;
const freshIp = () => `10.0.0.${(ipCounter += 1)}`;

describe('bearer authentication (as called from hooks.server.ts)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('sets locals.user like a session and ensures the app user', async () => {
		resolveApiToken.mockResolvedValue({ kind: 'valid', userId: 'user-1', tokenId: 't1' });
		getAuthUserById.mockResolvedValue(authUser);
		const event = fakeEvent();
		expect(await authenticateBearer(event, 'clg_x', freshIp())).toBeNull();
		expect(event.locals.user).toEqual(authUser);
		expect(event.locals.session).toBeNull();
		expect(ensureAppUser).toHaveBeenCalledWith(authUser);
	});

	it('answers 401 invalid_token for an unknown token', async () => {
		resolveApiToken.mockResolvedValue({ kind: 'invalid' });
		const response = await authenticateBearer(fakeEvent(), 'clg_bad', freshIp());
		expect(response?.status).toBe(401);
		expect(await response?.json()).toMatchObject({ code: 'invalid_token' });
	});

	it('answers 403 token_revoked for a revoked token', async () => {
		resolveApiToken.mockResolvedValue({ kind: 'revoked', tokenId: 't1' });
		const event = fakeEvent();
		const response = await authenticateBearer(event, 'clg_old', freshIp());
		expect(response?.status).toBe(403);
		expect(await response?.json()).toMatchObject({ code: 'token_revoked' });
		expect(event.locals.user).toBeUndefined();
	});

	it('answers 429 once an IP has 60 failures in a minute', async () => {
		resolveApiToken.mockResolvedValue({ kind: 'invalid' });
		const clientIp = freshIp();
		for (let attempt = 0; attempt < authFailureLimiter.maxFailures; attempt += 1) {
			expect((await authenticateBearer(fakeEvent(), 'clg_bad', clientIp))?.status).toBe(401);
		}
		const limited = await authenticateBearer(fakeEvent(), 'clg_bad', clientIp);
		expect(limited?.status).toBe(429);
		expect(await limited?.json()).toMatchObject({ code: 'rate_limited' });
	});
});
