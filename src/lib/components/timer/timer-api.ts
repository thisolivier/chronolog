/** Time calculation helpers for the timer widget. Data access goes through DataService. */

/** Calculate elapsed seconds from a start time string (HH:MM:SS) relative to now */
export function calculateElapsedFromStartTime(startTimeString: string): number {
	const timeParts = startTimeString.split(':').map(Number);
	const now = new Date();
	const startTotalSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + (timeParts[2] || 0);
	const nowTotalSeconds =
		now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
	return Math.max(0, nowTotalSeconds - startTotalSeconds);
}

/** What the timer completion form hands to TimerWidget when the user saves. */
export type TimerSaveData = {
	contractId: string;
	deliverableId: string;
	workTypeId: string;
	description: string;
	/** Present only when the user changed the measured time */
	durationMinutes?: number;
	startTime?: string | null;
	endTime?: string | null;
};

/** Seconds from one `HH:MM[:SS]` time to another, treating an earlier end as the next day. */
export function secondsBetweenTimes(startTimeString: string, endTimeString: string): number {
	const toSeconds = (timeString: string) => {
		const [hours = 0, minutes = 0, seconds = 0] = timeString.split(':').map(Number);
		return hours * 3600 + minutes * 60 + seconds;
	};
	const difference = toSeconds(endTimeString) - toSeconds(startTimeString);
	return difference >= 0 ? difference : difference + 24 * 3600;
}
