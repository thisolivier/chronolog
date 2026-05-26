/**
 * Tests for session-expiry handling in fetch-helpers.
 *
 * Verifies that 401 and 303-to-login responses trigger SessionExpiredError,
 * while normal errors are handled as before.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJson, SessionExpiredError, _resetSessionExpiredState } from './fetch-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockResponse(options: {
	ok?: boolean;
	status: number;
	body?: unknown;
	headers?: Record<string, string>;
}): Response {
	const { ok = options.status >= 200 && options.status < 300, status, body, headers = {} } = options;
	return {
		ok,
		status,
		json: () => Promise.resolve(body),
		text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
		headers: {
			get: (name: string) => headers[name.toLowerCase()] ?? null
		}
	} as unknown as Response;
}

describe('session-expiry handling in fetchJson', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		// Reset the redirect-in-progress flag between tests
		_resetSessionExpiredState();

		// Provide a minimal window.location mock so handleSessionExpired doesn't crash
		// when there's no window (Node test environment)
		if (typeof globalThis.window === 'undefined') {
			(globalThis as Record<string, unknown>).window = {
				location: { pathname: '/time', href: '' }
			};
		}
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('throws SessionExpiredError on 401 response', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			mockResponse({ status: 401, body: 'Unauthorized' })
		);

		await expect(fetchJson('/api/clients')).rejects.toThrow(SessionExpiredError);
	});

	it('throws SessionExpiredError on 303 redirect to login', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			mockResponse({
				status: 303,
				body: '',
				headers: { location: '/login?redirect=%2Ftime' }
			})
		);

		await expect(fetchJson('/api/clients')).rejects.toThrow(SessionExpiredError);
	});

	it('does NOT trigger session expiry for regular errors like 500', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			mockResponse({ status: 500, body: 'Internal Server Error' })
		);

		await expect(fetchJson('/api/clients')).rejects.toThrow('failed (500)');
		// Should throw a plain Error, not SessionExpiredError
		try {
			await fetchJson('/api/clients');
		} catch (error) {
			expect(error).not.toBeInstanceOf(SessionExpiredError);
		}
	});

	it('does NOT trigger session expiry for 303 redirects NOT to login', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(
			mockResponse({
				status: 303,
				body: '',
				headers: { location: '/dashboard' }
			})
		);

		// Should throw a normal error, not SessionExpiredError
		try {
			await fetchJson('/api/clients');
		} catch (error) {
			expect(error).not.toBeInstanceOf(SessionExpiredError);
			expect((error as Error).message).toContain('failed (303)');
		}
	});

	it('returns parsed JSON for successful responses', async () => {
		const clients = [{ id: '1', name: 'Test Client' }];
		globalThis.fetch = vi.fn().mockResolvedValue(
			mockResponse({ status: 200, body: clients })
		);

		const result = await fetchJson('/api/clients');
		expect(result).toEqual(clients);
	});

	it('SessionExpiredError includes status code and URL', () => {
		const error = new SessionExpiredError(401, '/api/clients');
		expect(error.name).toBe('SessionExpiredError');
		expect(error.message).toContain('401');
		expect(error.message).toContain('/api/clients');
	});
});
