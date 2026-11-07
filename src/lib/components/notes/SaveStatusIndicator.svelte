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
		saved: 'w-[4.75rem] justify-center bg-leaf-50 text-leaf-700 ring-leaf-200',
		saving: 'w-[4.75rem] justify-center bg-ochre-50 text-ochre-700 ring-ochre-200',
		draft: 'w-[4.75rem] justify-center bg-chalk-100 text-ink-faint ring-divider',
		failed: 'bg-rust-50 text-rust-700 ring-rust-200'
	};
	const dotClasses: Record<SaveStatusTone, string> = {
		saved: 'bg-leaf-500',
		saving: 'bg-ochre-400 animate-pulse',
		draft: 'bg-chalk-300',
		failed: 'bg-rust-500'
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
