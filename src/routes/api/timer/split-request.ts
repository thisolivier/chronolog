/**
 * Reads the body of `POST /api/timer/split` (sprint 056-DR) without touching the database. The
 * route then checks references (`entryReferenceProblem`) and runs the transaction
 * (`$lib/server/db/queries/timer-split.ts`).
 */
import type { EntryContent, SplitRequest } from '$lib/server/db/queries/timer-split';
import { parseLocalMoment } from './timer-moments';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** As `readClientRequestId`, but at most 90 characters: the draft gets `<id>:remainder` (REMAINDER_MARK_SUFFIX). */
const SPLIT_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,90}$/;

export type SplitRequestProblem = { code: string; message: string };
export type SplitRequestResult = { ok: true; request: SplitRequest } | { ok: false; problem: SplitRequestProblem };

const invalid = (message: string, code = 'invalid_split'): SplitRequestResult => ({ ok: false, problem: { code, message } });

function optionalText(value: unknown): string | null | undefined {
	if (value === undefined || value === null || value === '') return null;
	return typeof value === 'string' ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Contract, deliverable, work type and description (empty text counts as none); a string error when malformed. */
function readContent(source: Record<string, unknown>, side: string): EntryContent | { contractId: null; description: string | null } | string {
	const contractId = optionalText(source.contractId);
	const deliverableId = optionalText(source.deliverableId);
	const workTypeId = optionalText(source.workTypeId);
	const description = optionalText(source.description);
	if (contractId === undefined || deliverableId === undefined || workTypeId === undefined || description === undefined) {
		return `${side} contractId, deliverableId, workTypeId and description must be text`;
	}
	if (!contractId) {
		if (deliverableId || workTypeId) return `${side} needs a contract before a deliverable or work type`;
		return { contractId: null, description };
	}
	return { contractId, deliverableId, workTypeId, description };
}

export function readSplitRequest(body: Record<string, unknown>): SplitRequestResult {
	if (typeof body.entryId !== 'string' || !UUID_PATTERN.test(body.entryId)) return invalid('entryId must be the draft timer id');
	const expectedStartedAt = parseLocalMoment(body.expectedStartedAt);
	if (!expectedStartedAt) return invalid('expectedStartedAt must be YYYY-MM-DDTHH:MM[:SS] (the start the client shows)');
	const boundary = parseLocalMoment(body.boundary);
	if (!boundary) return invalid('boundary must be YYYY-MM-DDTHH:MM[:SS]', 'invalid_boundary');
	if (typeof body.clientRequestId !== 'string' || !SPLIT_REQUEST_ID_PATTERN.test(body.clientRequestId)) {
		return invalid('clientRequestId is required: 1-90 letters, digits, dots, colons, dashes or underscores', 'invalid_client_request_id');
	}

	if (!isObject(body.left)) return invalid('left must be { action: "save" | "discard", ... }');
	let left: SplitRequest['left'];
	if (body.left.action === 'discard') {
		left = { action: 'discard' };
	} else if (body.left.action === 'save') {
		const content = readContent(body.left, 'left');
		if (typeof content === 'string') return invalid(content);
		if (!content.contractId) return invalid('left needs a contract to be saved', 'contract_required');
		left = { action: 'save', ...content };
	} else {
		return invalid('left.action must be "save" or "discard"');
	}

	if (body.right !== undefined && body.right !== null && !isObject(body.right)) return invalid('right must be an object');
	const rightContent = readContent(isObject(body.right) ? body.right : {}, 'right');
	if (typeof rightContent === 'string') return invalid(rightContent);
	const right: SplitRequest['right'] = rightContent.contractId
		? { kind: 'draft', content: rightContent }
		: { kind: 'pending', description: rightContent.description };

	return {
		ok: true,
		request: { entryId: body.entryId, expectedStartedAt, boundary, clientRequestId: body.clientRequestId, left, right }
	};
}
