/** API functions for timer operations, extracted from TimerWidget for modularity. */

export type TimerStatus = {
	timer: {
		id: string;
		startTime: string | null;
		endTime: string | null;
		durationMinutes: number;
	} | null;
};

export type TimerEntry = {
	id: string;
	startTime: string | null;
	endTime: string | null;
	durationMinutes: number;
};

export type ContractOption = {
	id: string;
	name: string;
	isActive: boolean;
	clientId: string;
	clientName: string;
	clientShortCode: string;
};

/** Fetch the current running timer status */
export async function fetchTimerStatus(): Promise<TimerStatus> {
	const response = await fetch('/api/timer/status');
	if (!response.ok) throw new Error('Failed to fetch timer status');
	return response.json();
}

/** Start a new timer with the first available contract */
export async function apiStartTimer(): Promise<TimerEntry> {
	const contractResponse = await fetch('/api/contracts');
	if (!contractResponse.ok) throw new Error('Failed to load contracts');

	const contractList: ContractOption[] = await contractResponse.json();
	if (contractList.length === 0) {
		throw new Error('No contracts available. Create a contract in Admin first.');
	}

	const firstContract =
		contractList.find((contract) => contract.isActive) || contractList[0];

	const response = await fetch('/api/timer/start', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ contractId: firstContract.id })
	});

	if (!response.ok) {
		const errorData = await response
			.json()
			.catch(() => ({ message: 'Failed to start timer' }));
		throw new Error(errorData.message || 'Failed to start timer');
	}

	return response.json();
}

/** Stop the current running timer */
export async function apiStopTimer(): Promise<TimerEntry> {
	const response = await fetch('/api/timer/stop', { method: 'POST' });
	if (!response.ok) throw new Error('Failed to stop timer');
	return response.json();
}

/** Save a completed timer entry with full context */
export async function apiSaveTimer(data: {
	entryId: string;
	contractId: string;
	deliverableId: string;
	workTypeId: string;
	description: string;
}): Promise<void> {
	const response = await fetch('/api/timer/save', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	});
	if (!response.ok) throw new Error('Failed to save time entry');
}

/** Discard a draft timer entry */
export async function apiDiscardTimer(entryId: string): Promise<void> {
	await fetch('/api/timer/discard', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ entryId })
	});
}

/** Update a draft time entry's contract and/or description while timer is running */
export async function apiUpdateDraft(
	entryId: string,
	data: { contractId?: string; description?: string }
): Promise<void> {
	const response = await fetch(`/api/time-entries/${entryId}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	});
	if (!response.ok) throw new Error('Failed to update draft entry');
}

/** Create a manual time entry */
export async function apiCreateManualEntry(data: {
	date: string;
	durationMinutes: number;
	contractId: string;
	description?: string;
	startTime?: string;
	endTime?: string;
}): Promise<{ id: string }> {
	const response = await fetch('/api/time-entries', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	});
	if (!response.ok) throw new Error('Failed to create time entry');
	const result = await response.json();
	return result.entry;
}

/** Calculate elapsed seconds from a start time string (HH:MM:SS) relative to now */
export function calculateElapsedFromStartTime(startTimeString: string): number {
	const timeParts = startTimeString.split(':').map(Number);
	const now = new Date();
	const startTotalSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + (timeParts[2] || 0);
	const nowTotalSeconds =
		now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
	return Math.max(0, nowTotalSeconds - startTotalSeconds);
}
