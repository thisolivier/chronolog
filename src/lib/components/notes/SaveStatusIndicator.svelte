<!--
	The editor header's save pill (sprint 051-UI): "Saved" (green) / "Saving" (amber) / "Draft"
	(grey) in one fixed width, so the header line never shifts or wraps while typing. A failed save
	or a conflict is a red pill sized to its message. Labels: `save-status-display.ts`.
-->
<script lang="ts">
	import type { SaveStatus } from './note-autosave';
	import { saveStatusDisplay, type SaveStatusTone } from './save-status-display';

	interface Props {
		status: SaveStatus;
		isDraft?: boolean;
	}

	let { status, isDraft = false }: Props = $props();

	const toneClasses: Record<SaveStatusTone, string> = {
		saved: 'w-[4.75rem] justify-center bg-green-50 text-green-700 ring-green-200',
		saving: 'w-[4.75rem] justify-center bg-amber-50 text-amber-700 ring-amber-200',
		draft: 'w-[4.75rem] justify-center bg-stone-100 text-stone-500 ring-stone-200',
		failed: 'bg-red-50 text-red-700 ring-red-200'
	};
	const dotClasses: Record<SaveStatusTone, string> = {
		saved: 'bg-green-500',
		saving: 'bg-amber-400 animate-pulse',
		draft: 'bg-stone-300',
		failed: 'bg-red-500'
	};

	let display = $derived(saveStatusDisplay(status, isDraft));
</script>

<span
	role="status"
	aria-live="polite"
	data-testid="save-status"
	data-status={display.dataStatus}
	title={display.title}
	class="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs leading-4 whitespace-nowrap ring-1 ring-inset {toneClasses[
		display.tone
	]}"
>
	<span class="h-1.5 w-1.5 flex-shrink-0 rounded-full {dotClasses[display.tone]}" aria-hidden="true"></span>
	{display.label}
</span>
