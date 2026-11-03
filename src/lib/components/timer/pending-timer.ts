/**
 * A timer started before any contract was chosen lives only in the browser until the
 * user picks one: the server draft needs a contract, and the app must never guess it.
 * It is kept in localStorage so a reload or the phone's panel switch does not lose it.
 */
export type PendingTimer = {
	/** Local `YYYY-MM-DD` the timer was started on */
	date: string;
	/** Local `HH:MM:SS` the timer was started at */
	startTime: string;
	description: string;
	/** Set once stopped (`HH:MM:SS`) */
	endTime?: string;
};

const STORAGE_KEY = 'chronolog.pending-timer';

export function readPendingTimer(): PendingTimer | null {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return null;
		const parsed = JSON.parse(stored) as Partial<PendingTimer>;
		if (typeof parsed.date !== 'string' || typeof parsed.startTime !== 'string') return null;
		return {
			date: parsed.date,
			startTime: parsed.startTime,
			description: typeof parsed.description === 'string' ? parsed.description : '',
			endTime: typeof parsed.endTime === 'string' ? parsed.endTime : undefined
		};
	} catch {
		return null;
	}
}

export function writePendingTimer(pendingTimer: PendingTimer): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingTimer));
	} catch {
		// Storage unavailable (private mode): the timer still runs for this page
	}
}

export function clearPendingTimer(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Nothing to clear
	}
}
