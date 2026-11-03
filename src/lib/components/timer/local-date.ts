/** Local-time date and time strings (the browser's clock, never UTC). */

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

/** `YYYY-MM-DD` in local time. */
export function localDateString(moment: Date = new Date()): string {
	return `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;
}

/** `HH:MM:SS` in local time. */
export function localTimeString(moment: Date = new Date()): string {
	return `${pad(moment.getHours())}:${pad(moment.getMinutes())}:${pad(moment.getSeconds())}`;
}
