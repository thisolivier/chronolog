/**
 * Data for the trash page (`/notes/trash`, sprint 043-CL): the caller's trashed notes from
 * `GET /api/notes/trash` (most recently deleted first) and how long each has before the purge.
 */
export type TrashedNote = {
	id: string;
	title: string | null;
	contractId: string;
	/** `SHORTCODE/Contract name` */
	contract: string;
	deletedAt: string;
	purgeAt: string;
};

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

export async function fetchTrashedNotes(fetcher: typeof fetch = fetch): Promise<TrashedNote[]> {
	const response = await fetcher('/api/notes/trash');
	if (!response.ok) throw new Error(`Trash request failed (${response.status})`);
	return ((await response.json()) as { notes: TrashedNote[] }).notes;
}

/** Whole days left before `purgeAt` (rounded up, never below 0) */
export function daysUntilPurge(purgeAt: string, now: Date = new Date()): number {
	return Math.max(0, Math.ceil((new Date(purgeAt).getTime() - now.getTime()) / DAY_MILLISECONDS));
}

/** "29 days left", "1 day left", "purged today" */
export function purgeLabel(purgeAt: string, now: Date = new Date()): string {
	const days = daysUntilPurge(purgeAt, now);
	if (days === 0) return 'purged today';
	return `${days} ${days === 1 ? 'day' : 'days'} left`;
}

/** "4 Nov 2026" in the reader's locale */
export function formatDeletedDate(deletedAt: string): string {
	return new Date(deletedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
