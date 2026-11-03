<script lang="ts">
	/** Page frame for /settings and /admin: one app header, the offline banner, a centred column. */
	import type { Snippet } from 'svelte';
	import ConnectionStatus from '$lib/components/layout/ConnectionStatus.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="min-h-screen bg-stone-50">
	<header class="border-b border-stone-200 bg-white shadow-sm">
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
			<a href="/" class="text-lg font-bold text-stone-900">Chronolog</a>
			<a
				href="/"
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
