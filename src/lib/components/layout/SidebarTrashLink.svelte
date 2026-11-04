<!--
	SidebarTrashLink — "Trash" at the bottom of the contracts sidebar, under the Archived item
	(sprint 043-CL), in the same muted grammar: a link to the trash page `/notes/trash`. Chosen over
	the foot of the note list because the trash spans every contract and is rarely needed.
-->
<script lang="ts">
	import { TRASH_PATH } from '$lib/stores/navigation-routes';

	/** Draw the divider above it (when there is no Archived item to sit under) */
	let { withDivider = false }: { withDivider?: boolean } = $props();
</script>

<div class={withDivider ? 'mt-3 border-t border-stone-200 pt-2' : ''}>
	<a
		href={TRASH_PATH}
		class="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs font-semibold uppercase text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
		data-testid="sidebar-trash-link"
	>
		<svg class="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
		</svg>
		<span class="flex-1">Trash</span>
	</a>
</div>
