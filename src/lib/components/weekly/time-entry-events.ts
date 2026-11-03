/**
 * Window-level event that tells the timesheet (TimeEntriesPanel) a time entry was
 * saved somewhere it cannot see: the timer widget or the Add Entry modal, which
 * live in the sidebar. Mirrors the `note-saved` / `note-moved` pattern used by
 * NoteEditorPanel -> NoteListPanel.
 */
export const TIME_ENTRY_SAVED_EVENT = 'time-entry-saved';

export type TimeEntrySavedDetail = {
	/** Id of the saved entry, or null when the saver does not know it */
	entryId: string | null;
	/** ISO date (YYYY-MM-DD) of the saved entry, or null when unknown */
	date: string | null;
};

/** Dispatch a `time-entry-saved` event on `window` (no-op outside the browser). */
export function dispatchTimeEntrySaved(detail: Partial<TimeEntrySavedDetail> = {}): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(
		new CustomEvent<TimeEntrySavedDetail>(TIME_ENTRY_SAVED_EVENT, {
			detail: { entryId: detail.entryId ?? null, date: detail.date ?? null }
		})
	);
}

/** Read the detail from a `time-entry-saved` event, tolerating a missing payload. */
export function readTimeEntrySavedDetail(event: Event): TimeEntrySavedDetail {
	const detail = (event as CustomEvent<Partial<TimeEntrySavedDetail> | undefined>).detail ?? {};
	return { entryId: detail.entryId ?? null, date: detail.date ?? null };
}
