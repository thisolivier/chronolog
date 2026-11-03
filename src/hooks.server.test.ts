/**
 * Tests for the auth guard in hooks.server.ts: unauthenticated API requests get
 * a 401 JSON body, unauthenticated page requests get a 303 to /login, public
 * routes pass through, and a throwing getSession counts as "no session".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const getSession = vi.fn();

// Mutable so the device-gate tests can switch the gate on; null hash = gate disabled.
const mockEnvironment: { deviceAccessKeyHash: string | null } = { deviceAccessKeyHash: null };
vi.mock('$lib/server/env', () => ({ getServerEnvironment: () => mockEnvironment }));
vi.mock('$lib/server/db', () => ({ database: {} }));
vi.mock('$lib/server/auth', () => ({ auth: { api: { getSession } } }));
vi.mock('better-auth/svelte-kit', () => ({
	svelteKitHandler: ({ event, resolve }: { event: RequestEvent; resolve: (e: RequestEvent) => Response }) =>
		resolve(event)
}));

const { handle } = await import('./hooks.server');
const { hashDeviceKey, deviceCookieValue } = await import('$lib/server/device-gate/device-key');

function makeEvent(
	pathname: string,
	options: { headers?: Record<string, string>; cookies?: Record<string, string>; clientAddress?: string } = {}
): RequestEvent {
	const url = new URL(`http://localhost:5173${pathname}`);
	const cookieJar = options.cookies ?? {};
	return {
		request: new Request(url, { headers: options.headers }),
		url,
		locals: {},
		cookies: { get: (name: string) => cookieJar[name] },
		getClientAddress: () => options.clientAddress ?? '127.0.0.1'
	} as unknown as RequestEvent;
}

const resolve = vi.fn(async () => new Response('resolved', { status: 200 }));

beforeEach(() => {
	getSession.mockReset();
	resolve.mockClear();
	vi.spyOn(console, 'error').mockImplementation(() => {});
	mockEnvironment.deviceAccessKeyHash = null;
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

describe('hooks.server handle device gate', () => {
	const rawKey = 'device-gate-test-key';
	const configuredHash = hashDeviceKey(rawKey);

	beforeEach(() => {
		mockEnvironment.deviceAccessKeyHash = configuredHash;
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	it('redirects pages to /unlock and never looks up the session', async () => {
		await expect(handle({ event: makeEvent('/'), resolve })).rejects.toMatchObject({
			status: 303,
			location: '/unlock'
		});
		await expect(handle({ event: makeEvent('/login'), resolve })).rejects.toMatchObject({
			location: '/unlock'
		});
		expect(getSession).not.toHaveBeenCalled();
	});

	it('answers /api/* (including /api/auth) with 401 JSON from the gate', async () => {
		for (const pathname of ['/api/clients', '/api/auth/sign-in/email']) {
			const response = await handle({ event: makeEvent(pathname), resolve });
			expect(response.status).toBe(401);
			expect(await response.json()).toEqual({ error: 'Device not authorised' });
		}
		expect(getSession).not.toHaveBeenCalled();
	});

	it('serves the exempt paths without a key or a session lookup', async () => {
		for (const pathname of ['/unlock', '/_app/immutable/entry/start.js', '/manifest.webmanifest', '/sw.js']) {
			const response = await handle({ event: makeEvent(pathname), resolve });
			expect(response.status).toBe(200);
		}
		expect(getSession).not.toHaveBeenCalled();
	});

	it('passes a correct X-Device-Key header through to the auth guard', async () => {
		getSession.mockResolvedValue(null);
		const response = await handle({
			event: makeEvent('/api/clients', { headers: { 'x-device-key': rawKey } }),
			resolve
		});
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
		expect(getSession).toHaveBeenCalledTimes(1);
	});

	it('passes a valid unlock cookie and rejects a forged one', async () => {
		getSession.mockResolvedValue(null);
		const unlocked = handle({
			event: makeEvent('/time', { cookies: { chronolog_device: deviceCookieValue(configuredHash) } }),
			resolve
		});
		await expect(unlocked).rejects.toMatchObject({ location: '/login' });

		const forged = handle({ event: makeEvent('/time', { cookies: { chronolog_device: 'forged' } }), resolve });
		await expect(forged).rejects.toMatchObject({ location: '/unlock' });
	});

	it('locks an IP out after five wrong header keys and logs without the key', async () => {
		const attackerAddress = '198.51.100.77';
		const statuses: number[] = [];
		for (let attempt = 1; attempt <= 6; attempt += 1) {
			const response = await handle({
				event: makeEvent('/api/clients', {
					headers: { 'x-device-key': `wrong-${attempt}`, 'cf-connecting-ip': attackerAddress }
				}),
				resolve
			});
			statuses.push(response.status);
		}
		expect(statuses).toEqual([401, 401, 401, 401, 429, 429]);
		const logLines = vi.mocked(console.warn).mock.calls.map((call) => String(call[0]));
		expect(logLines.some((line) => line.includes(`LOCKOUT ip=${attackerAddress}`))).toBe(true);
		expect(logLines.every((line) => !line.includes('wrong-'))).toBe(true);

		// Even the right key is refused while locked
		const lockedResponse = await handle({
			event: makeEvent('/api/clients', { headers: { 'x-device-key': rawKey, 'cf-connecting-ip': attackerAddress } }),
			resolve
		});
		expect(lockedResponse.status).toBe(429);
	});
});
