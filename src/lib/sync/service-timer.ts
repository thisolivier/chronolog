/**
 * Timer Service Methods — SyncedDataService Mixin
 *
 * Extracted from SyncedDataService to keep file sizes manageable.
 * Provides timer operations: start, stop, save, discard, updateDraft.
 */

import type { StorageAdapter } from '$lib/storage';
import type { TimerEntry, TimerSaveData } from './data-types';
import type { TimeEntryRow } from '../storage/types';

type EnqueueFn = (
	table: string,
	entityId: string,
	operation: 'upsert' | 'delete',
	data: Record<string, unknown>
) => Promise<void>;

/**
 * Get the current timer status. Online: server API. Offline: find local draft.
 */
export async function fetchTimerStatus(
	storage: StorageAdapter,
	isOnline: boolean
): Promise<{ timer: TimerEntry | null }> {
	if (isOnline) {
		try {
			const response = await fetch('/api/timer/status');
			if (!response.ok) throw new Error('Server error');
			return response.json();
		} catch {
			// Fall through to local
		}
	}

	const drafts = await storage.query('timeEntries', {
		isDraft: true
	} as Partial<TimeEntryRow>);

	if (drafts.length === 0) return { timer: null };

	const draft = drafts[0];
	return {
		timer: {
			id: draft.id,
			startTime: draft.startTime,
			endTime: draft.endTime,
			durationMinutes: draft.durationMinutes
		}
	};
}

/**
 * Start a new timer. Online: server API. Offline: create local draft.
 */
export async function startTimerAction(
	storage: StorageAdapter,
	isOnline: boolean,
	contractId?: string
): Promise<TimerEntry> {
	if (isOnline) {
		try {
			if (!contractId) {
				const contractResponse = await fetch('/api/contracts');
				if (contractResponse.ok) {
					const contracts = await contractResponse.json();
					const firstActive = contracts.find(
						(contract: { isActive: boolean }) => contract.isActive
					);
					contractId = firstActive?.id ?? contracts[0]?.id;
				}
			}

			if (!contractId) throw new Error('No contracts available');

			const response = await fetch('/api/timer/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contractId })
			});
			if (!response.ok) throw new Error('Failed to start timer');
			return response.json();
		} catch {
			// Fall through to offline
		}
	}

	if (!contractId) {
		const contracts = await storage.getAll('contracts');
		const firstActive = contracts.find((contract) => contract.isActive);
		contractId = firstActive?.id ?? contracts[0]?.id;
	}

	if (!contractId) throw new Error('No contracts available offline');

	const entryId = crypto.randomUUID();
	const now = new Date();
	const timeStr = now.toTimeString().split(' ')[0];
	const dateStr = now.toISOString().slice(0, 10);

	const draftRow = {
		id: entryId,
		userId: '',
		contractId,
		deliverableId: null,
		workTypeId: null,
		date: dateStr,
		startTime: timeStr,
		endTime: null,
		durationMinutes: 0,
		description: null,
		isDraft: true,
		createdAt: now.toISOString(),
		updatedAt: now.toISOString()
	};

	await storage.put('timeEntries', draftRow);

	return {
		id: entryId,
		startTime: timeStr,
		endTime: null,
		durationMinutes: 0
	};
}

/**
 * Stop a running timer. Online: server API. Offline: compute end time locally.
 */
export async function stopTimerAction(
	storage: StorageAdapter,
	isOnline: boolean,
	entryId: string
): Promise<TimerEntry> {
	if (isOnline) {
		try {
			const response = await fetch('/api/timer/stop', { method: 'POST' });
			if (!response.ok) throw new Error('Failed to stop timer');
			const result = await response.json();
			const existing = await storage.getById('timeEntries', entryId);
			if (existing) {
				await storage.put('timeEntries', {
					...existing,
					endTime: result.endTime,
					durationMinutes: result.durationMinutes
				});
			}
			return result;
		} catch {
			// Fall through to offline
		}
	}

	const existing = await storage.getById('timeEntries', entryId);
	if (!existing) throw new Error('Timer entry not found');

	const now = new Date();
	const endTimeStr = now.toTimeString().split(' ')[0];

	let durationMinutes = 0;
	if (existing.startTime) {
		const startParts = existing.startTime.split(':').map(Number);
		const startTotalSeconds = startParts[0] * 3600 + startParts[1] * 60 + (startParts[2] || 0);
		const nowTotalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
		durationMinutes = Math.max(0, Math.round((nowTotalSeconds - startTotalSeconds) / 60));
	}

	await storage.put('timeEntries', {
		...existing,
		endTime: endTimeStr,
		durationMinutes,
		updatedAt: now.toISOString()
	});

	return {
		id: entryId,
		startTime: existing.startTime,
		endTime: endTimeStr,
		durationMinutes
	};
}

/**
 * Save a completed timer entry. Online: server API. Offline: local + queue.
 */
export async function saveTimerAction(
	storage: StorageAdapter,
	isOnline: boolean,
	entryId: string,
	data: TimerSaveData,
	enqueueMutation: EnqueueFn
): Promise<void> {
	if (isOnline) {
		try {
			const response = await fetch('/api/timer/save', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ entryId, ...data })
			});
			if (!response.ok) throw new Error('Failed to save timer');
			const existing = await storage.getById('timeEntries', entryId);
			if (existing) {
				const savedRow = {
					...existing,
					...data,
					isDraft: false,
					updatedAt: new Date().toISOString()
				};
				await storage.put('timeEntries', savedRow);
			}
			return;
		} catch {
			// Fall through to offline
		}
	}

	const existing = await storage.getById('timeEntries', entryId);
	if (!existing) return;

	const savedRow = {
		...existing,
		...data,
		isDraft: false,
		updatedAt: new Date().toISOString()
	};
	await storage.put('timeEntries', savedRow);
	await enqueueMutation('timeEntries', entryId, 'upsert', savedRow);
}

/**
 * Discard a draft timer entry.
 */
export async function discardTimerAction(
	storage: StorageAdapter,
	isOnline: boolean,
	entryId: string
): Promise<void> {
	if (isOnline) {
		try {
			await fetch('/api/timer/discard', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ entryId })
			});
		} catch {
			// Best effort
		}
	}
	await storage.delete('timeEntries', entryId);
}

/**
 * Update a draft timer entry's contract and/or description.
 */
export async function updateDraftAction(
	storage: StorageAdapter,
	isOnline: boolean,
	entryId: string,
	data: { contractId?: string; description?: string }
): Promise<void> {
	if (isOnline) {
		try {
			const response = await fetch(`/api/time-entries/${entryId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			if (!response.ok) throw new Error('Failed to update draft');
		} catch {
			// Best effort -- fall through to local update
		}
	}

	const existing = await storage.getById('timeEntries', entryId);
	if (existing) {
		await storage.put('timeEntries', {
			...existing,
			...data,
			updatedAt: new Date().toISOString()
		});
	}
}
