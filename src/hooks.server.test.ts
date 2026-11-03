/**
 * Tests for the auth guard in hooks.server.ts: unauthenticated API requests get
 * a 401 JSON body, unauthenticated page requests get a 303 to /login, public
 * routes pass through, and a throwing getSession counts as "no session".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const getSession = vi.fn();

vi.mock('$lib/server/env', () => ({ getServerEnvironment: () => ({}) }));
vi.mock('$lib/server/db', () => ({ database: {} }));
vi.mock('$lib/server/auth', () => ({ auth: { api: { getSession } } }));
vi.mock('better-auth/svelte-kit', () => ({
	svelteKitHandler: ({ event, resolve }: { event: RequestEvent; resolve: (e: RequestEvent) => Response }) =>
		resolve(event)
}));

const { handle } = await import('./hooks.server');

function makeEvent(pathname: string): RequestEvent {
	const url = new URL(`http://localhost:5173${pathname}`);
	return { request: new Request(url), url, locals: {} } as unknown as RequestEvent;
}

const resolve = vi.fn(async () => new Response('resolved', { status: 200 }));

beforeEach(() => {
	getSession.mockReset();
	resolve.mockClear();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('hooks.server handle auth guard', () => {
	it('returns 401 JSON for unauthenticated /api/* requests', async () => {
		getSession.mockResolvedValue(null);
		const response = await handle({ event: makeEvent('/api/clients'), resolve });
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
		expect(resolve).not.toHaveBeenCalled();
	});

	it('redirects unauthenticated page requests to /login with 303', async () => {
		getSession.mockResolvedValue(null);
		await expect(handle({ event: makeEvent('/time'), resolve })).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
	});

	it('lets unauthenticated requests through on public routes', async () => {
		getSession.mockResolvedValue(null);
		for (const pathname of ['/login', '/register', '/api/auth/sign-in/email']) {
			const response = await handle({ event: makeEvent(pathname), resolve });
			expect(response.status).toBe(200);
		}
	});

	it('treats a throwing getSession as no session (401 on API)', async () => {
		getSession.mockRejectedValue(new Error('database unreachable'));
		const response = await handle({ event: makeEvent('/api/notes'), resolve });
		expect(response.status).toBe(401);
		expect(console.error).toHaveBeenCalledTimes(1);
	});
});
