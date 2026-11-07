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

<div class="safe-area-shell min-h-dvh bg-chalk-50">
	<header class="border-b border-divider bg-surface shadow-sm">
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
			<!-- Back / Forward through the journey (050-UI), on wider screens -->
			<div class="flex items-center gap-3">
				<a href={navigation.workspaceHref} class="text-lg font-bold text-ink">Chronolog</a>
				<div class="hidden md:block"><HistoryButtons /></div>
			</div>
			<a
				href={navigation.workspaceHref}
				class="rounded-md btn-secondary px-3 py-1.5 text-sm"
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
