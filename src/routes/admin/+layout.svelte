<script lang="ts">
	let { children } = $props();
</script>

<div class="min-h-screen bg-stone-50">
	<header class="border-b border-stone-200 bg-white shadow-sm">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
			<div class="flex items-center gap-4">
				<a href="/" class="text-xl font-bold text-stone-900">Chronolog</a>
				<span class="text-stone-400">/</span>
				<a href="/admin" class="text-sm font-medium text-stone-600 hover:text-stone-900">Admin</a>
			</div>
			<div class="flex items-center gap-4">
				<a
					href="/"
					class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
				>
					Back to Dashboard
				</a>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-5xl p-6">
		{@render children()}
	</main>
</div>
