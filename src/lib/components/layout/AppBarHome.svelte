<!--
	The app bar's left group on every layout (sprint 062-DR): the "Chronolog" wordmark is the home
	button (`navigation.goHome`, a new step to `/`: the phone's home screen, this week's timesheet
	on wider screens; a running or unfinished capture is untouched), then ‹ › right of it. Used by
	AppShell (desktop, tablet, phone, /search), SettingsShell and the trash page.
-->
<script lang="ts">
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import HistoryButtons from './HistoryButtons.svelte';

	interface Props {
		/** `phone`: the AppShell phone bar's ‹ also goes one level up (HistoryButtons) */
		variant?: 'desktop' | 'phone';
		class?: string;
	}

	let { variant = 'desktop', class: className = '' }: Props = $props();

	const navigation = getNavigationContext();
</script>

<div class="flex flex-shrink-0 items-center {className}" data-testid="app-home-group">
	<button
		type="button"
		onclick={() => navigation.goHome()}
		class="-ml-2 flex h-11 flex-shrink-0 items-center rounded-md px-2 text-sm font-semibold text-ink-soft hover:bg-chalk-100 hover:text-ink md:h-8 md:pointer-coarse:h-11"
		aria-label="Chronolog home"
		title="Home"
		data-testid="app-home-button"
	>
		Chronolog
	</button>
	<HistoryButtons {variant} />
</div>
