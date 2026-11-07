/**
 * Human labels for workspace places: the phone's "← Back" names where it goes, and the phone
 * title bar names where you are (sprint 027-CL, journey review rule 4).
 */
import { parseWorkspacePath, TRASH_PATH, type WorkspaceRoute } from '$lib/stores/navigation-routes';
import { contractDirectory } from '$lib/stores/contract-directory.svelte';
import { getCachedNoteTitle } from '$lib/components/notes/note-titles.svelte';
import { calendarWeekNumber } from '$lib/utils/calendar-week';

const MAX_LABEL_LENGTH = 24;

/** The all-notes view's name (sprint 051-UI): Back / Forward labels, phone title, page title */
export const ALL_NOTES_LABEL = 'All notes';

function shorten(label: string): string {
	return label.length > MAX_LABEL_LENGTH ? `${label.slice(0, MAX_LABEL_LENGTH - 1)}…` : label;
}

/** "Week 45", "Rocket Build", the note's title, "Chronolog" */
export function labelForRoute(route: WorkspaceRoute): string {
	if (route.kind === 'home') return 'Chronolog';
	if (route.kind === 'time') return `Week ${calendarWeekNumber(route.week)}`;
	if (route.draft) return 'New note';
	if (route.noteId) return shorten(getCachedNoteTitle(route.noteId)?.displayTitle || 'Note');
	if (route.kind === 'client') return shorten(contractDirectory.clientName(route.clientId) ?? 'Notes');
	if (route.kind === 'all') return ALL_NOTES_LABEL;
	return shorten(contractDirectory.labels[route.contractId]?.name ?? 'Notes');
}

/** Label for any in-app path (a history entry may be settings, admin, search or the trash) */
export function labelForPath(path: string, fallbackWeek: string): string {
	if (path === TRASH_PATH) return 'Trash';
	const route = parseWorkspacePath(path, fallbackWeek);
	if (route) return labelForRoute(route);
	if (path.startsWith('/settings') || path.startsWith('/admin')) return 'Settings';
	if (path.startsWith('/search')) return 'Search';
	return 'Back';
}

/** The note a history entry shows, so its title can be fetched for the label */
export function noteIdOfPath(path: string | null): string | null {
	const route = path ? parseWorkspacePath(path, '') : null;
	return route && route.kind !== 'home' && route.kind !== 'time' ? route.noteId : null;
}

/** Phone title bar: where you are */
export function titleForRoute(route: WorkspaceRoute): string {
	if (route.kind === 'home') return 'Chronolog';
	if (route.kind === 'time') return `Time entries · Week ${calendarWeekNumber(route.week)}`;
	if (route.kind === 'client') return contractDirectory.clientName(route.clientId) ?? 'Notes';
	if (route.kind === 'all') return ALL_NOTES_LABEL;
	return contractDirectory.contextLabel(route.contractId) ?? 'Notes';
}
