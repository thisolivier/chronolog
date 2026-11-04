/**
 * Sprint 046-CL: the /search page shows notes and time entries as one list, newest first. The API
 * still returns them in two groups (the CLI reads that shape), so the interleave happens here.
 *
 * Sort key, compared as text in local time: a note by its last modified moment (as the page shows
 * it), an entry by its date then start time. An entry without a start time sorts as the start of
 * its day. Ties keep the server's order (notes first, each group in its own ranking).
 */
import type { GlobalSearchResponse, NoteHit, TimeEntryHit } from './search-types';

export type SearchListItem = { kind: 'note'; hit: NoteHit; sortKey: string } | { kind: 'entry'; hit: TimeEntryHit; sortKey: string };

function padTwo(value: number): string {
	return String(value).padStart(2, '0');
}

/** `YYYY-MM-DDTHH:MM` in local time, so it compares with an entry's local date and start time */
export function localSortKey(isoMoment: string): string {
	const moment = new Date(isoMoment);
	return `${moment.getFullYear()}-${padTwo(moment.getMonth() + 1)}-${padTwo(moment.getDate())}T${padTwo(moment.getHours())}:${padTwo(moment.getMinutes())}`;
}

export function entrySortKey(hit: Pick<TimeEntryHit, 'date' | 'startTime'>): string {
	return `${hit.date}T${(hit.startTime ?? '00:00').slice(0, 5)}`;
}

/** Notes and entries in one list, newest first */
export function interleaveSearchHits(result: Pick<GlobalSearchResponse, 'notes' | 'timeEntries'>): SearchListItem[] {
	const items: SearchListItem[] = [
		...result.notes.hits.map((hit) => ({
			kind: 'note' as const,
			hit,
			sortKey: localSortKey(hit.updatedAt)
		})),
		...result.timeEntries.hits.map((hit) => ({
			kind: 'entry' as const,
			hit,
			sortKey: entrySortKey(hit)
		}))
	];
	// Array.prototype.sort is stable, so equal keys keep the server's order
	return items.sort((first, second) => (first.sortKey < second.sortKey ? 1 : first.sortKey > second.sortKey ? -1 : 0));
}

function countLabel(shown: number, total: number, singular: string, plural: string): string {
	const noun = total === 1 ? singular : plural;
	return shown < total ? `${shown} of ${total} ${noun}` : `${total} ${noun}`;
}

/** "4 notes · 7 time entries" ("50 of 120 notes" when the server cut the list) */
export function searchSummary(result: Pick<GlobalSearchResponse, 'notes' | 'timeEntries'>): string {
	return [
		countLabel(result.notes.hits.length, result.notes.total, 'note', 'notes'),
		countLabel(result.timeEntries.hits.length, result.timeEntries.total, 'time entry', 'time entries')
	].join(' · ');
}

/** "Oct 20": an entry's date on a phone, where the full day header does not fit */
export function formatEntryDateShort(dateString: string): string {
	return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric'
	});
}
