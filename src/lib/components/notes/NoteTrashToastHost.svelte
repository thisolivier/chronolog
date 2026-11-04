<!--
	NoteTrashToastHost — the "Moved to trash. Undo" toast (sprint 037-CL), mounted once by the
	workspace layout since sprint 043-CL so it survives the editor panel unmounting (phone). Undo
	takes the note out of the trash and opens it again.
-->
<script lang="ts">
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { getDataService } from '$lib/services/context';
	import { restoreTrashedNote } from './note-trash';
	import { dismissTrashToast, showTrashToastError, trashToastState } from './note-trash-toast.svelte';

	const navigation = getNavigationContext();
	const dataService = getDataService();

	async function undoDelete() {
		const toast = dismissTrashToast();
		if (!toast) return;
		try {
			const restored = await restoreTrashedNote(dataService, toast.noteId);
			navigation.openNote(toast.noteId, restored.note.contractId, toast.clientId);
		} catch (restoreError) {
			console.error('Error restoring note:', restoreError);
			showTrashToastError('Could not restore the note');
		}
	}
</script>

{#if trashToastState.toast || trashToastState.error}
	<div
		role="status"
		data-testid="note-trash-toast"
		class="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-md bg-stone-800 px-4 py-2 text-sm text-white shadow-lg"
		style="margin-bottom: env(safe-area-inset-bottom);"
	>
		{#if trashToastState.toast}
			<span>Moved to trash.</span>
			<button type="button" onclick={undoDelete} class="font-semibold text-indigo-300 hover:text-indigo-200">Undo</button>
		{:else}
			<span>{trashToastState.error}</span>
		{/if}
	</div>
{/if}
