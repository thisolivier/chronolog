/** Time calculation helpers for the timer widget. Data access goes through DataService. */

/**
 * Seconds a timer has been running: from its local start (`date` YYYY-MM-DD plus `HH:MM[:SS]`)
 * to `now`. The date matters: a timer started at 23:50 yesterday has run 20 minutes at 00:10.
 * Without a date (old pending timers), the start is taken as the latest such time not after
 * now, so a start "later" than now counts as yesterday instead of as zero.
 */
export function calculateElapsedFromStartTime(
	startTimeString: string,
	startDateString?: string,
	now: Date = new Date()
): number {
	const [hours = 0, minutes = 0, seconds = 0] = startTimeString.split(':').map(Number);
	const dateMatch = startDateString?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (dateMatch) {
		const startMoment = new Date(
			Number(dateMatch[1]),
			Number(dateMatch[2]) - 1,
			Number(dateMatch[3]),
			hours,
			minutes,
			seconds
		);
		return Math.max(0, Math.floor((now.getTime() - startMoment.getTime()) / 1000));
	}
	const nowTime = [now.getHours(), now.getMinutes(), now.getSeconds()].join(':');
	return secondsBetweenTimes(startTimeString, nowTime);
}

/** Running-timer clock text, `HH:MM:SS`, shared by the timer widget and the top-bar pill */
export function formatElapsedClock(totalSeconds: number): string {
	const wholeSeconds = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(wholeSeconds / 3600);
	const minutes = Math.floor((wholeSeconds % 3600) / 60);
	const seconds = wholeSeconds % 60;
	return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
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
