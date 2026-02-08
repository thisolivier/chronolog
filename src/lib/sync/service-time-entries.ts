/**
 * Time Entries Service Methods — SyncedDataService Mixin
 *
 * Extracted from SyncedDataService to keep file sizes manageable.
 * Provides CRUD operations for time entries and weekly statuses.
 */

import type { StorageAdapter } from '$lib/storage';
import type { WeekData, TimeEntryCreateData, TimeEntryUpdateData } from './data-types';
import type { WeeklyStatusRow } from '../storage/types';
import { queryWeeklyTimeEntries } from './local-queries';

type EnqueueFn = (
	table: string,
	entityId: string,
	operation: 'upsert' | 'delete',
	data: Record<string, unknown>
) => Promise<void>;

/**
 * Fetch weekly time entries. Online: server API. Offline: local storage.
 */
export async function fetchWeeklyTimeEntries(
	storage: StorageAdapter,
	isOnline: boolean,
	weekStarts: string[]
): Promise<WeekData[]> {
	if (isOnline) {
		try {
			const weeksParam = weekStarts.join(',');
			const response = await fetch(
				`/api/time-entries/weekly?weeks=${weeksParam}`
			);
			if (!response.ok) throw new Error('Server error');
			const data = await response.json();
			return data.weeks;
		} catch {
			// Fall through to local
		}
	}
	return queryWeeklyTimeEntries(storage, weekStarts);
}

/**
 * Create a time entry. Online: server API. Offline: local + queue.
 */
export async function createTimeEntryAction(
	storage: StorageAdapter,
	isOnline: boolean,
	data: TimeEntryCreateData,
	enqueueMutation: EnqueueFn
): Promise<{ id: string }> {
	if (isOnline) {
		try {
			const response = await fetch('/api/time-entries', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			if (!response.ok) throw new Error('Server error');
			const result = await response.json();
			return result.entry;
		} catch {
			// Fall through to offline
		}
	}

	const entryId = crypto.randomUUID();
	const now = new Date().toISOString();
	const entryRow = {
		id: entryId,
		userId: '',
		contractId: data.contractId,
		deliverableId: null,
		workTypeId: null,
		date: data.date,
		startTime: null,
		endTime: null,
		durationMinutes: data.durationMinutes,
		description: data.description ?? null,
		isDraft: false,
		createdAt: now,
		updatedAt: now
	};

	await storage.put('timeEntries', entryRow);
	await enqueueMutation('timeEntries', entryId, 'upsert', entryRow);

	return { id: entryId };
}

/**
 * Update a time entry. Online: server API + local cache. Offline: local + queue.
 */
export async function updateTimeEntryAction(
	storage: StorageAdapter,
	isOnline: boolean,
	entryId: string,
	data: TimeEntryUpdateData,
	enqueueMutation: EnqueueFn
): Promise<void> {
	const now = new Date().toISOString();

	if (isOnline) {
		try {
			const response = await fetch(`/api/time-entries/${entryId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			if (!response.ok) throw new Error('Server error');
			const existing = await storage.getById('timeEntries', entryId);
			if (existing) {
				await storage.put('timeEntries', { ...existing, ...data, updatedAt: now });
			}
			return;
		} catch {
			// Fall through to offline
		}
	}

	const existing = await storage.getById('timeEntries', entryId);
	if (!existing) return;

	const updatedRow = { ...existing, ...data, updatedAt: now };
	await storage.put('timeEntries', updatedRow);
	await enqueueMutation('timeEntries', entryId, 'upsert', updatedRow);
}

/**
 * Delete a time entry. Online: server API. Offline: local + queue.
 */
export async function deleteTimeEntryAction(
	storage: StorageAdapter,
	isOnline: boolean,
	entryId: string,
	enqueueMutation: EnqueueFn
): Promise<void> {
	if (isOnline) {
		try {
			const response = await fetch(`/api/time-entries/${entryId}`, {
				method: 'DELETE'
			});
			if (!response.ok) throw new Error('Server error');
			await storage.delete('timeEntries', entryId);
			return;
		} catch {
			// Fall through to offline
		}
	}

	await storage.delete('timeEntries', entryId);
	await enqueueMutation('timeEntries', entryId, 'delete', { id: entryId });
}

/**
 * Update weekly status. Online: server API. Offline: local + queue.
 */
export async function updateWeeklyStatusAction(
	storage: StorageAdapter,
	isOnline: boolean,
	year: number,
	weekNumber: number,
	status: string,
	enqueueMutation: EnqueueFn
): Promise<void> {
	if (isOnline) {
		try {
			const response = await fetch('/api/time-entries/weekly-statuses', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ year, weekNumber, status })
			});
			if (!response.ok) throw new Error('Server error');
			return;
		} catch {
			// Fall through to offline
		}
	}

	const existingStatuses = await storage.query('weeklyStatuses', {
		year,
		weekNumber
	} as Partial<WeeklyStatusRow>);

	const now = new Date().toISOString();
	if (existingStatuses.length > 0) {
		const existing = existingStatuses[0];
		const updatedRow = { ...existing, status, updatedAt: now };
		await storage.put('weeklyStatuses', updatedRow);
		await enqueueMutation('weeklyStatuses', existing.id, 'upsert', updatedRow);
	} else {
		const newId = crypto.randomUUID();
		const newRow = {
			id: newId,
			userId: '',
			weekStart: '',
			year,
			weekNumber,
			status,
			createdAt: now,
			updatedAt: now
		};
		await storage.put('weeklyStatuses', newRow);
		await enqueueMutation('weeklyStatuses', newId, 'upsert', newRow);
	}
}
