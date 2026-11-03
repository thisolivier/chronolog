<!-- Small saved / saving / unsaved / failed indicator for the note editor header -->
<script lang="ts">
	import type { SaveStatus } from './note-autosave';

	interface Props {
		status: SaveStatus;
		isDraft?: boolean;
	}

	let { status, isDraft = false }: Props = $props();

	const labels: Record<SaveStatus, string> = {
		saved: 'Saved',
		saving: 'Saving…',
		unsaved: 'Unsaved changes',
		error: "Couldn't save — retrying"
	};

	const dotClasses: Record<SaveStatus, string> = {
		saved: 'bg-green-500',
		saving: 'bg-amber-400 animate-pulse',
		unsaved: 'bg-amber-400',
		error: 'bg-red-500'
	};

	let label = $derived(isDraft && status === 'saved' ? 'Not saved yet' : labels[status]);
</script>

<span
	role="status"
	aria-live="polite"
	data-testid="save-status"
	data-status={isDraft && status === 'saved' ? 'draft' : status}
	class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs {status === 'error'
		? 'text-red-600'
		: 'text-stone-400'}"
>
	<span class="h-1.5 w-1.5 rounded-full {isDraft && status === 'saved' ? 'bg-stone-300' : dotClasses[status]}"></span>
	{label}
</span>
