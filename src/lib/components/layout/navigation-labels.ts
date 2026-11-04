/**
 * Human labels for workspace places: the phone's "← Back" names where it goes, and the phone
 * title bar names where you are (sprint 027-CL, journey review rule 4).
 */
import { parseWorkspacePath, type WorkspaceRoute } from '$lib/stores/navigation-routes';
import { contractDirectory } from '$lib/stores/contract-directory.svelte';
import { getCachedNoteTitle } from '$lib/components/notes/note-titles.svelte';
import { getIsoWeekNumber } from '$lib/utils/iso-week';

const MAX_LABEL_LENGTH = 24;

function shorten(label: string): string {
	return label.length > MAX_LABEL_LENGTH ? `${label.slice(0, MAX_LABEL_LENGTH - 1)}…` : label;
}

/** "Week 45", "Rocket Build", the note's title, "Chronolog" */
export function labelForRoute(route: WorkspaceRoute): string {
	if (route.kind === 'home') return 'Chronolog';
	if (route.kind === 'time') return `Week ${getIsoWeekNumber(route.week)}`;
	if (route.draft) return 'New note';
	if (route.noteId) return shorten(getCachedNoteTitle(route.noteId)?.displayTitle || 'Note');
	if (route.kind === 'client') return shorten(contractDirectory.clientName(route.clientId) ?? 'Notes');
	return shorten(contractDirectory.labels[route.contractId]?.name ?? 'Notes');
}

/** Label for any in-app path (the previous history entry may be settings or admin) */
export function labelForPath(path: string, fallbackWeek: string): string {
	const route = parseWorkspacePath(path, fallbackWeek);
	if (route) return labelForRoute(route);
	if (path.startsWith('/settings') || path.startsWith('/admin')) return 'Settings';
	return 'Back';
}

/** Phone title bar: where you are */
export function titleForRoute(route: WorkspaceRoute): string {
	if (route.kind === 'home') return 'Chronolog';
	if (route.kind === 'time') return `Time entries · Week ${getIsoWeekNumber(route.week)}`;
	if (route.kind === 'client') return contractDirectory.clientName(route.clientId) ?? 'Notes';
	return contractDirectory.contextLabel(route.contractId) ?? 'Notes';
}
