/**
 * Request readers shared by the `/api/*` routes (sprint 029-CL).
 *
 * - `readJsonObject` parses a JSON object body; a missing, malformed or non-object body becomes a
 *   400 in the shared `{ error, code, message }` shape instead of an unhandled 500.
 * - `readRequestTimezone` resolves the caller's IANA timezone from `?tz=` or `X-Timezone`
 *   (the CLI and the browser both send the header), falling back to the server's zone.
 */

import { apiError } from './api-errors';
import { isValidTimezone } from '$lib/utils/local-calendar';

export type JsonObjectResult =
	| { ok: true; body: Record<string, unknown> }
	| { ok: false; response: Response };

export async function readJsonObject(request: Request): Promise<JsonObjectResult> {
	let parsed: unknown;
	try {
		parsed = await request.json();
	} catch {
		return { ok: false, response: apiError(400, 'Invalid JSON body', 'invalid_json') };
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return { ok: false, response: apiError(400, 'Body must be a JSON object', 'invalid_json') };
	}
	return { ok: true, body: parsed as Record<string, unknown> };
}

export type TimezoneResult = { ok: true; timezone: string } | { ok: false; response: Response };

export function serverTimezone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function readRequestTimezone(url: URL, request: Request): TimezoneResult {
	const requested = url.searchParams.get('tz') ?? request.headers.get('x-timezone');
	if (!requested) return { ok: true, timezone: serverTimezone() };
	if (!isValidTimezone(requested)) {
		return { ok: false, response: apiError(400, `Unknown timezone “${requested}”`, 'invalid_timezone') };
	}
	return { ok: true, timezone: requested };
}
