<!--
	PhoneCaptureScreen — the phone's focused capture surface (design r1 TC-08, sprint 055-DR).
	The header pill opens it over the screen the user was on; "Back" closes it and that screen is
	still there. Running: the large clock, start, contract, description, then Add note and Stop
	pinned at the bottom. Stopped: the whole completion form with Save and Discard pinned. No
	collapse chevron and no header timer (the surface covers the app bar). The surface fills the
	visual viewport, so the pinned actions sit just above the software keyboard and the home
	indicator, and the fields scroll beneath the identity header without being covered.
	Back never resumes or resolves anything: a stopped capture keeps its frozen end on the server
	row (or pending timer) and its fields in the capture store, and the pill reads Finish entry.
-->
<script lang="ts">
	import TimerWidget from './TimerWidget.svelte';
	import { captureScreen } from './capture-screen.svelte';
	import { VisualViewportBox } from './visual-viewport.svelte';

	const viewportBox = new VisualViewportBox();
	$effect(() => viewportBox.track());

	// Leaving the phone layout (rotation, resize) closes the surface; the widget there takes over
	$effect(() => () => captureScreen.close());

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || event.target instanceof HTMLSelectElement) return;
		// The Add Time Entry modal opened from here handles its own Escape
		if (document.querySelector('[data-testid="add-entry-backdrop"]')) return;
		captureScreen.close();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="fixed inset-x-0 z-40 flex flex-col bg-surface pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]"
	style={viewportBox.style}
	role="dialog"
	aria-modal="true"
	aria-label="Timer"
	data-testid="phone-capture-screen"
>
	<div class="flex h-12 shrink-0 items-center px-2">
		<button
			type="button"
			onclick={() => captureScreen.close()}
			class="flex min-h-11 items-center px-2 text-sm font-medium text-pine-600 hover:text-pine-800"
			data-testid="capture-screen-back"
		>
			&larr; Back
		</button>
	</div>
	<TimerWidget placement="screen" onLeave={() => captureScreen.close()} />
</div>
