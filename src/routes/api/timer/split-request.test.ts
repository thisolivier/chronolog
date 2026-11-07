import { describe, it, expect } from 'vitest';
import { readSplitRequest } from './split-request';

const entryId = '0b7e4c2a-5d1f-4a8e-9c3b-2f6d8e1a4b7c';
const contractId = '1c8f5d3b-6e2a-4b9f-8d4c-3a7e9f2b5c8d';
const base = {
	entryId,
	expectedStartedAt: '2026-11-07T09:00:00',
	boundary: '2026-11-07T09:50',
	clientRequestId: 'split-abc',
	left: { action: 'save', contractId, description: 'Workshop [[20261107-1]]' }
};

describe('readSplitRequest', () => {
	it('reads a left save with a blank (pending) right', () => {
		const result = readSplitRequest(base);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.request.boundary).toEqual({ date: '2026-11-07', time: '09:50:00' });
		expect(result.request.left).toEqual({ action: 'save', contractId, deliverableId: null, workTypeId: null, description: 'Workshop [[20261107-1]]' });
		expect(result.request.right).toEqual({ kind: 'pending', description: null });
	});

	it('reads a left discard and a right with a contract (stays the server draft)', () => {
		const result = readSplitRequest({ ...base, left: { action: 'discard' }, right: { contractId, description: 'Follow-up' } });
		expect(result.ok && result.request.left).toEqual({ action: 'discard' });
		expect(result.ok && result.request.right).toEqual({
			kind: 'draft',
			content: { contractId, deliverableId: null, workTypeId: null, description: 'Follow-up' }
		});
	});

	it('keeps a description on a pending right', () => {
		const result = readSplitRequest({ ...base, right: { description: 'Next thing' } });
		expect(result.ok && result.request.right).toEqual({ kind: 'pending', description: 'Next thing' });
	});

	it.each([
		[{ entryId: 'nope' }, 'invalid_split'],
		[{ expectedStartedAt: '09:00' }, 'invalid_split'],
		[{ boundary: '2026-11-07T25:00' }, 'invalid_boundary'],
		[{ clientRequestId: undefined }, 'invalid_client_request_id'],
		[{ clientRequestId: 'x'.repeat(91) }, 'invalid_client_request_id'],
		[{ left: { action: 'keep' } }, 'invalid_split'],
		[{ left: { action: 'save' } }, 'contract_required'],
		[{ left: { action: 'save', contractId, description: 7 } }, 'invalid_split'],
		[{ right: { deliverableId: contractId } }, 'invalid_split'],
		[{ right: 'blank' }, 'invalid_split']
	])('refuses %j with %s', (override, code) => {
		const result = readSplitRequest({ ...base, ...override });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.problem.code).toBe(code);
	});
});
