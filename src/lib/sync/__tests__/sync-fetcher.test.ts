/**
 * Tests for sync-fetcher — HTTP Transport Layer
 */

import { describe, it, expect, vi } from 'vitest';
import {
	pullFromServer,
	pushToServer,
	SyncAuthError,
	SyncNetworkError,
	SyncServerError
} from '../sync-fetcher';
import type { SyncPullResponse, SyncPushResponse, PendingMutation } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockFetch(
	responseBody: unknown,
	options: { status?: number; ok?: boolean } = {}
): typeof globalThis.fetch {
	const { status = 200, ok = true } = options;

	return vi.fn().mockResolvedValue({
		ok,
		status,
		json: () => Promise.resolve(responseBody),
		text: () => Promise.resolve(JSON.stringify(responseBody))
	} as Partial<Response>) as unknown as typeof globalThis.fetch;
}

function createNetworkErrorFetch(): typeof globalThis.fetch {
	return vi.fn().mockRejectedValue(
		new TypeError('Failed to fetch')
	) as unknown as typeof globalThis.fetch;
}

const samplePullResponse = {
	clients: [{ id: 'c1', name: 'Client 1' }],
	contracts: [],
	deliverables: [],
	workTypes: [],
	timeEntries: [],
	notes: [],
	noteLinks: [],
	noteTimeEntries: [],
	weeklyStatuses: [],
	attachments: [],
	serverTimestamp: '2026-02-08T12:00:00.000Z'
} as unknown as SyncPullResponse;

const sampleMutations: PendingMutation[] = [
	{
		id: 'mut-1',
		table: 'clients',
		entityId: 'client-1',
		operation: 'upsert',
		data: { id: 'client-1', name: 'Updated' },
		timestamp: '2026-02-08T10:00:00.000Z'
	}
];

// ---------------------------------------------------------------------------
// pullFromServer
// ---------------------------------------------------------------------------

describe('pullFromServer', () => {
	it('should call fetch with correct URL when no since timestamp', async () => {
		const mockFetch = createMockFetch(samplePullResponse);

		await pullFromServer(null, mockFetch);

		expect(mockFetch).toHaveBeenCalledWith('/api/sync/pull', {
			method: 'GET',
			credentials: 'include',
			headers: { 'Accept': 'application/json' }
		});
	});

	it('should include since parameter in URL', async () => {
		const mockFetch = createMockFetch(samplePullResponse);
		const sinceTimestamp = '2026-02-08T10:00:00.000Z';

		await pullFromServer(sinceTimestamp, mockFetch);

		expect(mockFetch).toHaveBeenCalledWith(
			expect.stringContaining(`?since=${encodeURIComponent(sinceTimestamp)}`),
			expect.any(Object)
		);
	});

	it('should return parsed pull response', async () => {
		const mockFetch = createMockFetch(samplePullResponse);

		const result = await pullFromServer(null, mockFetch);

		expect(result).toEqual(samplePullResponse);
		expect(result.serverTimestamp).toBe('2026-02-08T12:00:00.000Z');
		expect(result.clients).toHaveLength(1);
	});

	it('should throw SyncAuthError on 401', async () => {
		const mockFetch = createMockFetch(
			{ error: 'Unauthorized' },
			{ status: 401, ok: false }
		);

		await expect(pullFromServer(null, mockFetch)).rejects.toThrow(
			SyncAuthError
		);
	});

	it('should throw SyncServerError on non-OK response', async () => {
		const mockFetch = createMockFetch(
			'Internal Server Error',
			{ status: 500, ok: false }
		);

		await expect(pullFromServer(null, mockFetch)).rejects.toThrow(
			SyncServerError
		);
	});

	it('should throw SyncNetworkError on network failure', async () => {
		const mockFetch = createNetworkErrorFetch();

		await expect(pullFromServer(null, mockFetch)).rejects.toThrow(
			SyncNetworkError
		);
	});
});

// ---------------------------------------------------------------------------
// pushToServer
// ---------------------------------------------------------------------------

describe('pushToServer', () => {
	const samplePushResponse: SyncPushResponse = {
		applied: 1,
		conflicts: 0,
		serverTimestamp: '2026-02-08T12:01:00.000Z'
	};

	it('should call fetch with POST and correct body', async () => {
		const mockFetch = createMockFetch(samplePushResponse);

		await pushToServer(sampleMutations, mockFetch);

		expect(mockFetch).toHaveBeenCalledWith('/api/sync/push', {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			body: expect.any(String)
		});

		// Verify the body structure groups by table
		const callArgs = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
		const parsedBody = JSON.parse(callArgs[1].body);
		expect(parsedBody.changes).toHaveProperty('clients');
		expect(parsedBody.changes.clients).toHaveLength(1);
		expect(parsedBody.changes.clients[0].operation).toBe('upsert');
	});

	it('should return parsed push response', async () => {
		const mockFetch = createMockFetch(samplePushResponse);

		const result = await pushToServer(sampleMutations, mockFetch);

		expect(result.applied).toBe(1);
		expect(result.conflicts).toBe(0);
	});

	it('should throw SyncAuthError on 401', async () => {
		const mockFetch = createMockFetch(
			{ error: 'Unauthorized' },
			{ status: 401, ok: false }
		);

		await expect(pushToServer(sampleMutations, mockFetch)).rejects.toThrow(
			SyncAuthError
		);
	});

	it('should throw SyncNetworkError on network failure', async () => {
		const mockFetch = createNetworkErrorFetch();

		await expect(pushToServer(sampleMutations, mockFetch)).rejects.toThrow(
			SyncNetworkError
		);
	});

	it('should group mutations from multiple tables', async () => {
		const mockFetch = createMockFetch(samplePushResponse);

		const multiTableMutations: PendingMutation[] = [
			{
				id: 'mut-1',
				table: 'clients',
				entityId: 'c1',
				operation: 'upsert',
				data: { id: 'c1' },
				timestamp: '2026-02-08T10:00:00.000Z'
			},
			{
				id: 'mut-2',
				table: 'notes',
				entityId: 'n1',
				operation: 'upsert',
				data: { id: 'n1' },
				timestamp: '2026-02-08T10:01:00.000Z'
			},
			{
				id: 'mut-3',
				table: 'clients',
				entityId: 'c2',
				operation: 'delete',
				data: { id: 'c2' },
				timestamp: '2026-02-08T10:02:00.000Z'
			}
		];

		await pushToServer(multiTableMutations, mockFetch);

		const callArgs = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
		const parsedBody = JSON.parse(callArgs[1].body);
		expect(parsedBody.changes.clients).toHaveLength(2);
		expect(parsedBody.changes.notes).toHaveLength(1);
	});
});
