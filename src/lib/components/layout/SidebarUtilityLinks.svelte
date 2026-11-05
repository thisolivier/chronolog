<!--
	SidebarUtilityLinks — the last rows of the sidebar's scrolling list, under the Archived item:
	"Trash" (sprint 043-CL, the trash page `/notes/trash`) and "Settings" (sprint 051-UI; it used to
	be a fixed footer above the timer). Same muted grammar as the Archived row: icon and label.
-->
<script lang="ts">
	import { TRASH_PATH } from '$lib/stores/navigation-routes';

	/** Draw the divider above them (when there is no Archived item to sit under) */
	let { withDivider = false }: { withDivider?: boolean } = $props();

	const rowClass =
		'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs font-semibold uppercase text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 pointer-coarse:py-3.5';
</script>

<div class={withDivider ? 'mt-3 border-t border-stone-200 pt-2' : ''}>
	<a href={TRASH_PATH} class={rowClass} data-testid="sidebar-trash-link">
		<svg class="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
		</svg>
		<span class="flex-1">Trash</span>
	</a>
	<a href="/settings" class={rowClass} data-testid="sidebar-settings-link">
		<svg class="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
		</svg>
		<span class="flex-1">Settings</span>
	</a>
</div>
