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
