/**
 * Input readers and response shapes shared by the admin-object routes (sprint 031-CL):
 * `/api/clients`, `/api/contracts`, `/api/deliverables`, `/api/work-types` and their `[id]`
 * routes. Every reader returns the value or a ready `Response` in the shared
 * `{ error, code, message }` shape, so a handler can `if (x instanceof Response) return x`.
 *
 * Ownership is checked by the query modules' `get…ForUser` lookups: another user's id is the
 * same 404 as a missing one, never a 403.
 */

import { apiError } from '$lib/server/api-errors';
import { duplicateShortCodeMessage } from '$lib/server/admin-actions';
import { isUuid } from '$lib/utils/uuid';

export type AdminObjectKind = 'client' | 'contract' | 'deliverable' | 'work type';

function capitalised(kind: AdminObjectKind): string {
	return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function unauthorized(): Response {
	return apiError(401, 'Unauthorized');
}

export function notFound(kind: AdminObjectKind): Response {
	return apiError(404, `${capitalised(kind)} not found`, 'not_found');
}

export function duplicateShortCode(shortCode: string): Response {
	return apiError(409, duplicateShortCodeMessage(shortCode), 'duplicate');
}

/** A path or body id: 400 when it is not a UUID (Postgres would 500 on it). */
export function readId(value: unknown, kind: AdminObjectKind): string | Response {
	return isUuid(value) ? value : apiError(400, `Invalid ${kind} ID`, 'invalid_id');
}

/** A required non-empty text field, trimmed. */
export function readRequiredText(body: Record<string, unknown>, field: string, message: string): string | Response {
	const value = body[field];
	if (typeof value !== 'string' || value.trim() === '') return apiError(400, message, 'invalid_input');
	return value.trim();
}

/** An optional text field: `undefined` when absent, a trimmed non-empty string otherwise. */
export function readOptionalText(body: Record<string, unknown>, field: string, message: string): string | undefined | Response {
	if (body[field] === undefined) return undefined;
	return readRequiredText(body, field, message);
}

/** An optional clearable text field: absent → `undefined`, `null` or blank → `null`. */
export function readClearableText(body: Record<string, unknown>, field: string): string | null | undefined | Response {
	const value = body[field];
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (typeof value !== 'string') return apiError(400, `${field} must be a string or null`, 'invalid_input');
	return value.trim() === '' ? null : value.trim();
}

export function readOptionalBoolean(body: Record<string, unknown>, field: string): boolean | undefined | Response {
	const value = body[field];
	if (value === undefined) return undefined;
	if (typeof value !== 'boolean') return apiError(400, `${field} must be true or false`, 'invalid_input');
	return value;
}

/** `sortOrder`: an integer; absent → `undefined` (the admin forms default it to 0 on create). */
export function readOptionalSortOrder(body: Record<string, unknown>): number | undefined | Response {
	const value = body.sortOrder;
	if (value === undefined) return undefined;
	if (typeof value !== 'number' || !Number.isInteger(value)) {
		return apiError(400, 'sortOrder must be a whole number', 'invalid_input');
	}
	return value;
}

export function wantsArchived(url: URL): boolean {
	return url.searchParams.get('includeArchived') === 'true';
}

/** First `Response` among parsed values, if any (a reader rejected its input). */
export function firstProblem(...values: unknown[]): Response | null {
	return (values.find((value) => value instanceof Response) as Response | undefined) ?? null;
}

// ── Response shapes ──────────────────────────────────────────────────

type ClientRow = {
	id: string;
	name: string;
	shortCode: string;
	emoji: string | null;
	colorIndex: number;
	sortOrder?: number;
	archivedAt: Date | null;
};

export function clientJson(client: ClientRow) {
	return {
		id: client.id,
		name: client.name,
		shortCode: client.shortCode,
		emoji: client.emoji,
		colorIndex: client.colorIndex,
		sortOrder: client.sortOrder ?? 0,
		archived: client.archivedAt !== null,
		archivedAt: client.archivedAt
	};
}

type ContractRow = {
	id: string;
	clientId: string;
	name: string;
	description: string | null;
	isActive: boolean;
	sortOrder: number;
	archivedAt: Date | null;
};

export function contractJson(contract: ContractRow) {
	return {
		id: contract.id,
		clientId: contract.clientId,
		name: contract.name,
		description: contract.description,
		isActive: contract.isActive,
		sortOrder: contract.sortOrder,
		archived: contract.archivedAt !== null,
		archivedAt: contract.archivedAt
	};
}
