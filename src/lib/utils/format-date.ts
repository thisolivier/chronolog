/**
 * Format a date string as a "smart" date display:
 * - Today: HH:mm (24-hour)
 * - Last 7 days: day name (e.g. "Monday")
 * - Older: DD/MM/YYYY
 */
export function formatSmartDate(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();

	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

	const differenceInDays = Math.floor(
		(todayStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24)
	);

	if (differenceInDays === 0) {
		return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
	}

	if (differenceInDays > 0 && differenceInDays < 7) {
		return date.toLocaleDateString('en-US', { weekday: 'long' });
	}

	const day = String(date.getDate()).padStart(2, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const year = date.getFullYear();
	return `${day}/${month}/${year}`;
}
