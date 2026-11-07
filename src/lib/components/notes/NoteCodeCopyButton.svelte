<!--
	NoteCodeCopyButton — the note code (e.g. `INTL.20261104.0042`) in the editor header; a click or
	tap copies it (sprint 051-UI). A "Copied" bubble floats over it for a moment (absolutely placed,
	so the header line does not move) and the result is announced in a polite live region. If the
	clipboard refuses, it says "Couldn't copy" and selects the code so it can be copied by hand.
	A small copy icon beside the code (054-DR, NT-04) runs the same copy.
-->
<script lang="ts">
	import { copyText } from '$lib/utils/copy-text';

	let { noteCode }: { noteCode: string } = $props();

	const CONFIRMATION_DURATION_MS = 1500;

	let confirmation = $state<string | null>(null);
	let codeElement = $state<HTMLElement | null>(null);
	let confirmationTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyNoteCode() {
		const copied = await copyText(noteCode);
		confirmation = copied ? 'Copied' : "Couldn't copy";
		if (!copied && codeElement) window.getSelection()?.selectAllChildren(codeElement);
		clearTimeout(confirmationTimer);
		confirmationTimer = setTimeout(() => (confirmation = null), CONFIRMATION_DURATION_MS);
	}

	$effect(() => () => clearTimeout(confirmationTimer));
</script>

<!-- Kept whole (flex-shrink-0): the client / contract label beside it truncates instead -->
<span class="relative inline-flex flex-shrink-0 items-center">
	<button
		type="button"
		onclick={copyNoteCode}
		title="Copy note code"
		aria-label="Copy note code {noteCode}"
		class="cursor-pointer rounded px-1 font-mono whitespace-nowrap text-xs text-ink-faint hover:bg-chalk-100 hover:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
		data-testid="note-code-copy"
	>
		<span class="font-mono" bind:this={codeElement}>{noteCode}</span>
	</button>
	<button
		type="button"
		onclick={copyNoteCode}
		title="Copy note code"
		aria-label="Copy note code"
		class="flex items-center justify-center rounded px-1 text-ink-faint hover:bg-chalk-100 hover:text-ink-muted pointer-coarse:min-h-11 pointer-coarse:min-w-11"
		data-testid="note-code-copy-icon"
	>
		<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" class="h-3.5 w-3.5" aria-hidden="true">
			<rect x="5.25" y="5.25" width="8" height="8.5" rx="1.25" />
			<path d="M10.75 5.25V3.5a1.25 1.25 0 0 0-1.25-1.25H3.5A1.25 1.25 0 0 0 2.25 3.5v6.25A1.25 1.25 0 0 0 3.5 11h1.75" />
		</svg>
	</button>
	{#if confirmation}
		<span
			class="pointer-events-none absolute top-full left-1/2 z-20 mt-1 -translate-x-1/2 rounded bg-chalk-800 px-2 py-0.5 text-[11px] whitespace-nowrap text-on-accent shadow"
			aria-hidden="true"
			data-testid="note-code-copied"
		>
			{confirmation}
		</span>
	{/if}
	<span class="sr-only" aria-live="polite" data-testid="note-code-copy-announcement">{confirmation ?? ''}</span>
</span>
