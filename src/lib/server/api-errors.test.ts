import { describe, expect, it } from 'vitest';
import { apiError, apiErrorCode, normalizeApiErrorResponse } from './api-errors';

describe('API error shape', () => {
	it('maps statuses to stable codes', () => {
		expect(apiErrorCode(401)).toBe('unauthorized');
		expect(apiErrorCode(403)).toBe('forbidden');
		expect(apiErrorCode(409)).toBe('conflict');
		expect(apiErrorCode(429)).toBe('rate_limited');
		expect(apiErrorCode(418)).toBe('http_418');
		expect(apiErrorCode(502)).toBe('internal_error');
	});

	it('builds { error, code, message } bodies', async () => {
		const response = apiError(403, 'Revoked', 'token_revoked');
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: 'Revoked', code: 'token_revoked', message: 'Revoked' });
	});

	it("rewrites SvelteKit's { message } errors and keeps extra fields", async () => {
		const sveltekit = new Response(JSON.stringify({ message: 'Note not found' }), { status: 404 });
		expect(await (await normalizeApiErrorResponse(sveltekit)).json()).toEqual({ error: 'Note not found', code: 'not_found', message: 'Note not found' });

		const conflict = new Response(JSON.stringify({ error: 'conflict', updatedAt: 'x' }), { status: 409 });
		expect(await (await normalizeApiErrorResponse(conflict)).json()).toEqual({ error: 'conflict', code: 'conflict', message: 'conflict', updatedAt: 'x' });
	});

	it('turns an HTML error page into JSON and leaves successes alone', async () => {
		const html = new Response('<html>oops</html>', { status: 500, statusText: 'Internal Error', headers: { 'content-type': 'text/html' } });
		const normalized = await normalizeApiErrorResponse(html);
		expect(normalized.headers.get('content-type')).toBe('application/json');
		expect((await normalized.json()).code).toBe('internal_error');

		const ok = new Response('{"fine":true}', { status: 200 });
		expect(await normalizeApiErrorResponse(ok)).toBe(ok);
	});
});
