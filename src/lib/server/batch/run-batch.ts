/**
 * The shared engine of `POST /api/notes/batch` and `POST /api/time-entries/batch` (sprint 038-CL).
 *
 * Each item is handled by the route's `processItem`, which throws `BatchItemError` for a problem
 * with that item (the item's error and code go into its result; the other items carry on). With
 * `atomic`, every item runs inside one transaction: the first failure rolls everything back, that
 * item keeps its error and every other item reports `batch_rolled_back`.
 *
 * `processItem` gets the transaction (atomic) or null (each item stands alone and calls the usual
 * query functions). Work that must only happen once the rows are committed (refreshing the
 * wiki-link index) is returned as `afterCommit`.
 */

import { json } from '@sveltejs/kit';
import { database } from '$lib/server/db';
import { apiError } from '$lib/server/api-errors';

export type BatchTransaction = Parameters<Parameters<typeof database.transaction>[0]>[0];

export class BatchItemError extends Error {
	constructor(
		message: string,
		readonly code: string,
		readonly extra: Record<string, unknown> = {}
	) {
		super(message);
		this.name = 'BatchItemError';
	}
}

export type BatchItemSuccess = {
	action: 'created' | 'updated';
	id: string;
	updatedAt?: string;
	/** Extra fields for the item's result, e.g. `unconditional: true` */
	extra?: Record<string, unknown>;
	afterCommit?: () => Promise<unknown>;
};

export type BatchItemResult = {
	index: number;
	ok: boolean;
	id?: string;
	updatedAt?: string;
	error?: string;
	code?: string;
	[field: string]: unknown;
};

export type BatchSummary = { results: BatchItemResult[]; created: number; updated: number; failed: number };

type ProcessItem = (item: Record<string, unknown>, index: number, transaction: BatchTransaction | null) => Promise<BatchItemSuccess>;

/**
 * Reads `{ items: [...], atomic?: boolean }` from a parsed body. A Response (400) when the shape
 * is wrong or there are more than `maxItems` items.
 */
export function readBatchBody(
	body: Record<string, unknown>,
	maxItems: number
): { items: unknown[]; atomic: boolean } | Response {
	const { items, atomic } = body;
	if (!Array.isArray(items)) return apiError(400, 'items must be an array', 'bad_request');
	if (items.length === 0) return apiError(400, 'items is empty', 'bad_request');
	if (items.length > maxItems) {
		return apiError(400, `At most ${maxItems} items per request (got ${items.length}); send them in chunks`, 'too_many_items');
	}
	if (atomic !== undefined && typeof atomic !== 'boolean') return apiError(400, 'atomic must be true or false', 'bad_request');
	return { items, atomic: atomic === true };
}

function asItemObject(item: unknown): Record<string, unknown> {
	if (item === null || typeof item !== 'object' || Array.isArray(item)) {
		throw new BatchItemError('Each item must be a JSON object', 'bad_request');
	}
	return item as Record<string, unknown>;
}

function failureResult(index: number, failure: unknown): BatchItemResult {
	if (failure instanceof BatchItemError) {
		return { ...failure.extra, index, ok: false, error: failure.message, code: failure.code };
	}
	console.error(`[batch] item ${index} failed unexpectedly`, failure);
	return { index, ok: false, error: 'Internal error while saving this item', code: 'internal_error' };
}

function successResult(index: number, success: BatchItemSuccess): BatchItemResult {
	const result: BatchItemResult = { ...success.extra, index, ok: true, id: success.id };
	if (success.updatedAt) result.updatedAt = success.updatedAt;
	return result;
}

function summarise(results: BatchItemResult[], actions: Array<BatchItemSuccess['action'] | null>): BatchSummary {
	return {
		results,
		created: actions.filter((action) => action === 'created').length,
		updated: actions.filter((action) => action === 'updated').length,
		failed: results.filter((result) => !result.ok).length
	};
}

/** The wiki-link refresh after a commit: the rows are saved, so a failure here is logged, not reported. */
async function runAfterCommit(success: BatchItemSuccess): Promise<void> {
	try {
		await success.afterCommit?.();
	} catch (failure) {
		console.error(`[batch] after-commit step for ${success.id} failed`, failure);
	}
}

class RolledBack extends Error {
	constructor(
		readonly failedIndex: number,
		readonly failure: unknown
	) {
		super('batch rolled back');
	}
}

export async function runBatch(items: unknown[], atomic: boolean, processItem: ProcessItem): Promise<BatchSummary> {
	if (!atomic) {
		const results: BatchItemResult[] = [];
		const actions: Array<BatchItemSuccess['action'] | null> = [];
		for (const [index, item] of items.entries()) {
			try {
				const success = await processItem(asItemObject(item), index, null);
				await runAfterCommit(success);
				results.push(successResult(index, success));
				actions.push(success.action);
			} catch (failure) {
				results.push(failureResult(index, failure));
				actions.push(null);
			}
		}
		return summarise(results, actions);
	}

	let successes: BatchItemSuccess[];
	try {
		successes = await database.transaction(async (transaction) => {
			const done: BatchItemSuccess[] = [];
			for (const [index, item] of items.entries()) {
				try {
					done.push(await processItem(asItemObject(item), index, transaction));
				} catch (failure) {
					throw new RolledBack(index, failure);
				}
			}
			return done;
		});
	} catch (thrown) {
		if (!(thrown instanceof RolledBack)) throw thrown;
		const results = items.map((_, index): BatchItemResult =>
			index === thrown.failedIndex
				? failureResult(index, thrown.failure)
				: {
						index,
						ok: false,
						error: `Not saved: item ${thrown.failedIndex} failed and the whole batch was rolled back`,
						code: 'batch_rolled_back'
					}
		);
		return summarise(results, results.map(() => null));
	}

	for (const success of successes) await runAfterCommit(success);
	return summarise(
		successes.map((success, index) => successResult(index, success)),
		successes.map((success) => success.action)
	);
}

export function batchResponse(summary: BatchSummary): Response {
	return json(summary);
}
