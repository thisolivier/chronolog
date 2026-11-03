/**
 * One error shape for every `/api/*` response (sprint 028-CL): `{ error, code, message }`.
 *
 * `error` is the human-readable text, `code` a stable machine string derived from the status
 * (or set explicitly), and `message` repeats `error` because the UI's fetch helpers read it.
 * Extra fields a route adds (e.g. `updatedAt` on a 409) are kept.
 *
 * `normalizeApiErrorResponse` is applied in `hooks.server.ts` to every `/api/*` response
 * outside Better Auth's own `/api/auth/*`, so routes that `throw error(…)` (SvelteKit's
 * `{ message }`, or an HTML page when the client did not ask for JSON) and routes that
 * return `json({ error })` all reach machine clients in the same shape.
 */

import { json } from '@sveltejs/kit';

const CODES_BY_STATUS: Record<number, string> = {
	400: 'bad_request',
	401: 'unauthorized',
	403: 'forbidden',
	404: 'not_found',
	405: 'method_not_allowed',
	409: 'conflict',
	413: 'payload_too_large',
	415: 'unsupported_media_type',
	422: 'unprocessable',
	429: 'rate_limited',
	500: 'internal_error',
	503: 'unavailable'
};

export function apiErrorCode(status: number): string {
	return CODES_BY_STATUS[status] ?? (status >= 500 ? 'internal_error' : `http_${status}`);
}

/** Builds an error response in the shared shape. */
export function apiError(
	status: number,
	errorText: string,
	code: string = apiErrorCode(status),
	extra: Record<string, unknown> = {}
): Response {
	return json({ ...extra, error: errorText, code, message: errorText }, { status });
}

function defaultText(status: number, statusText: string): string {
	return statusText || apiErrorCode(status).replace(/_/g, ' ');
}

/** Rewrites an error response's body into `{ error, code, message }`; other responses pass through. */
export async function normalizeApiErrorResponse(response: Response): Promise<Response> {
	if (response.status < 400) return response;

	const bodyText = await response.text().catch(() => '');
	let parsed: unknown = null;
	try {
		parsed = bodyText ? JSON.parse(bodyText) : null;
	} catch {
		parsed = null;
	}

	const body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
	const errorText =
		(typeof body.error === 'string' && body.error) ||
		(typeof body.message === 'string' && body.message) ||
		defaultText(response.status, response.statusText);
	const code = typeof body.code === 'string' && body.code ? body.code : apiErrorCode(response.status);

	const headers = new Headers(response.headers);
	headers.set('content-type', 'application/json');
	headers.delete('content-length');
	return new Response(JSON.stringify({ ...body, error: errorText, code, message: errorText }), {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
