<script lang="ts">
	/** Friendly 404 / 500 page (sprint 026-CL, finding 39). Never shows stack traces. */
	import { page } from '$app/state';

	const isNotFound = $derived(page.status === 404);
	const heading = $derived(isNotFound ? 'Page not found' : 'Something went wrong');
	const explanation = $derived(
		isNotFound
			? 'That address doesn’t match anything in Chronolog. It may have been deleted, or the link is mistyped.'
			: 'Chronolog hit an error loading this page. Your saved entries and notes are not affected. Try again in a moment.'
	);
</script>

<svelte:head><title>Chronolog · {isNotFound ? 'Not found' : 'Error'}</title></svelte:head>

<div class="flex min-h-dvh items-center justify-center bg-stone-50 p-4">
	<div class="w-full max-w-md rounded-lg border border-stone-200 bg-white p-8 text-center shadow-sm" data-testid="error-page">
		<p class="text-sm font-semibold text-stone-400">{page.status}</p>
		<h1 class="mt-2 text-2xl font-semibold text-stone-900">{heading}</h1>
		<p class="mt-3 text-sm text-stone-600">{explanation}</p>
		<div class="mt-6 flex justify-center gap-3">
			{#if !isNotFound}
				<button
					onclick={() => location.reload()}
					class="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
				>
					Try again
				</button>
			{/if}
			<a href="/" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
				Back to Chronolog
			</a>
		</div>
	</div>
</div>
