/**
 * Pure helpers for the WeekStrip per-day colour proportion bar.
 *
 * Minutes are aggregated per client so that each day renders exactly one segment per client,
 * keyed by `clientId`. Keying per entry (the previous approach, `colorClass + percentage`)
 * threw Svelte's `each_key_duplicate` as soon as two entries in one day shared a client colour
 * and a duration.
 */

import { getClientDotClass } from '$lib/utils/client-colors';

export type WeekStripDayEntry = {
	clientId: string;
	clientColorIndex: number;
	durationMinutes: number;
};

export type WeekStripColorSegment = {
	clientId: string;
	colorClass: string;
	percentage: number;
};

/**
 * Aggregates a day's entries into one colour segment per client, ordered by the client's first
 * appearance in `entries`. Returns an empty array when there are no entries or no minutes.
 */
export function computeColorSegments(entries: WeekStripDayEntry[]): WeekStripColorSegment[] {
	if (entries.length === 0) return [];

	const totalMinutesForDay = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
	if (totalMinutesForDay <= 0) return [];

	const minutesByClient = new Map<string, { colorIndex: number; minutes: number }>();
	for (const entry of entries) {
		const existingAggregate = minutesByClient.get(entry.clientId);
		if (existingAggregate) {
			existingAggregate.minutes += entry.durationMinutes;
		} else {
			minutesByClient.set(entry.clientId, {
				colorIndex: entry.clientColorIndex,
				minutes: entry.durationMinutes
			});
		}
	}

	const segments: WeekStripColorSegment[] = [];
	for (const [clientId, aggregate] of minutesByClient) {
		if (aggregate.minutes <= 0) continue;
		segments.push({
			clientId,
			colorClass: getClientDotClass(aggregate.colorIndex),
			percentage: (aggregate.minutes / totalMinutesForDay) * 100
		});
	}
	return segments;
}
