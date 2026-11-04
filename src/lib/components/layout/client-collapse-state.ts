/**
 * Which sidebar clients are collapsed (sprint 039-CL): a per-browser preference, like the Archived
 * item, stored as a JSON array of client IDs. Never collapsed by default. Storage can be missing or
 * throw (private windows, blocked site data), so every access is guarded.
 */
export const COLLAPSED_CLIENTS_STORAGE_KEY = 'chronolog:sidebar-collapsed-clients';

export function readCollapsedClientIds(storage: Storage | null | undefined): string[] {
	try {
		const parsed: unknown = JSON.parse(storage?.getItem(COLLAPSED_CLIENTS_STORAGE_KEY) ?? '[]');
		return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
	} catch {
		return [];
	}
}

export function writeCollapsedClientIds(storage: Storage | null | undefined, clientIds: string[]): void {
	try {
		storage?.setItem(COLLAPSED_CLIENTS_STORAGE_KEY, JSON.stringify(clientIds));
	} catch {
		// Not remembered in this browser; the chevron still works for this page
	}
}

/** The list with `clientId` collapsed or expanded */
export function withClientCollapsed(clientIds: string[], clientId: string, collapsed: boolean): string[] {
	const others = clientIds.filter((id) => id !== clientId);
	return collapsed ? [...others, clientId] : others;
}
