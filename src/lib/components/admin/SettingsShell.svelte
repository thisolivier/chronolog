<script lang="ts">
	/** Page frame for /settings and /admin: one app header, the offline banner, a centred column. */
	import type { Snippet } from 'svelte';
	import ConnectionStatus from '$lib/components/layout/ConnectionStatus.svelte';
	import { getNavigationContext } from '$lib/stores/navigation.svelte';
	import HistoryButtons from '$lib/components/layout/HistoryButtons.svelte';

	let { children }: { children: Snippet } = $props();

	// "Back to app" returns to the workspace place you left (sprint 027-CL), not always home
	const navigation = getNavigationContext();
</script>

<div class="safe-area-shell min-h-dvh bg-stone-50">
	<header class="border-b border-stone-200 bg-white shadow-sm">
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
			<!-- Back / Forward through the journey (050-UI), on wider screens -->
			<div class="flex items-center gap-3">
				<a href={navigation.workspaceHref} class="text-lg font-bold text-stone-900">Chronolog</a>
				<div class="hidden md:block"><HistoryButtons /></div>
			</div>
			<a
				href={navigation.workspaceHref}
				class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
			>
				Back to app
			</a>
		</div>
	</header>
	<ConnectionStatus />

	<main class="mx-auto max-w-5xl p-4 sm:p-6">
		{@render children()}
	</main>
</div>
