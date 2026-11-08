<!--
	Back / Forward through this tab's journey in the app (sprint 050-UI): the Mac app and the
	installed PWA have no browser buttons. Since 062-DR both layouts show ‹ › right of the
	"Chronolog" home button (AppBarHome.svelte), the unavailable one disabled. `desktop` walks the
	in-app history (`navigation.goBack` / `goForward`); `phone` (the AppShell phone bar) keeps the
	old "← Back" behaviour on ‹: the step before, or one level up when the app has no step before
	(a reload), so the drill-down never strands you. Both listen for Cmd+[ / Cmd+] and Alt+Left /
	Alt+Right. Targets are 44 px on a phone and on touch screens, 32 px with a mouse.
-->
<script lang="ts">
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import { requestNoteTitles } from '$lib/components/notes/note-titles.svelte';
	import { labelForPath, noteIdOfPath } from './navigation-labels';
	import { historyShortcutDirection } from './history-shortcuts';

	interface Props {
		variant?: 'desktop' | 'phone';
		class?: string;
	}

	let { variant = 'desktop', class: className = '' }: Props = $props();

	const navigation = getNavigationContext();
	const isPhone = $derived(variant === 'phone');

	// The phone's ‹ goes one level up when there is no step before (backTarget); desktop only walks history
	const backPath = $derived(isPhone ? navigation.backTarget.path : navigation.previousPath);
	const canGoBack = $derived(isPhone ? navigation.canGoBack || !navigation.isHome : navigation.canGoBack);

	// Note entries are labelled with the note's title once it is known (the cache is reactive)
	$effect(() => {
		const noteIds = [noteIdOfPath(backPath), noteIdOfPath(navigation.nextPath)].filter(
			(noteId): noteId is string => noteId !== null
		);
		if (noteIds.length > 0) requestNoteTitles(noteIds);
	});

	const fallbackWeek = $derived(navigation.selectedWeek ?? '');
	const backLabel = $derived(canGoBack && backPath ? `Back to ${labelForPath(backPath, fallbackWeek)}` : 'Back');
	const forwardLabel = $derived(
		navigation.nextPath ? `Forward to ${labelForPath(navigation.nextPath, fallbackWeek)}` : 'Forward'
	);

	function goBack() {
		if (isPhone) navigation.goBackMobile();
		else navigation.goBack();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		const direction = historyShortcutDirection(event);
		if (!direction) return;
		event.preventDefault();
		if (direction === 'back') navigation.goBack();
		else navigation.goForward();
	}

	const buttonClass = $derived(
		`flex flex-shrink-0 items-center justify-center rounded-md btn-quiet hover:text-ink disabled:cursor-default disabled:text-chalk-300 disabled:hover:bg-transparent ${
			isPhone ? 'h-11 w-11' : 'h-11 w-11 md:h-8 md:w-8 md:pointer-coarse:h-11 md:pointer-coarse:w-11'
		}`
	);
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#snippet chevron(direction: 'back' | 'forward')}
	<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4" aria-hidden="true">
		<path d={direction === 'back' ? 'M12.5 4.5 7 10l5.5 5.5' : 'M7.5 4.5 13 10l-5.5 5.5'} stroke-linecap="round" stroke-linejoin="round" />
	</svg>
{/snippet}

<div class="flex flex-shrink-0 items-center {className}" data-testid="history-buttons">
	<button
		type="button"
		onclick={goBack}
		disabled={!canGoBack}
		class={buttonClass}
		aria-label={backLabel}
		title={backLabel}
		data-testid={isPhone ? 'mobile-back' : 'history-back'}
	>
		{@render chevron('back')}
	</button>
	<button
		type="button"
		onclick={() => navigation.goForward()}
		disabled={!navigation.canGoForward}
		class={buttonClass}
		aria-label={forwardLabel}
		title={forwardLabel}
		data-testid={isPhone ? 'mobile-forward' : 'history-forward'}
	>
		{@render chevron('forward')}
	</button>
</div>
