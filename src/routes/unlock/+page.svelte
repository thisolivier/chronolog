<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Chronolog · Unlock</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-stone-50">
	<div class="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
		<div class="text-center">
			<h1 class="text-3xl font-bold text-stone-900">Chronolog</h1>
			<p class="mt-2 text-stone-600">Enter this server's device access key</p>
		</div>

		{#if form?.error}
			<div class="rounded-md bg-red-50 p-4 text-sm text-red-700" role="alert">
				{form.error}
			</div>
		{/if}

		<!-- Plain POST (no enhance): works before hydration and keeps the key out of client JS state. -->
		<form method="POST" class="space-y-6">
			<div>
				<label for="device-key" class="block text-sm font-medium text-stone-700">Device key</label>
				<input
					id="device-key"
					name="deviceKey"
					type="password"
					autocomplete="off"
					required
					class="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					placeholder="Paste the key"
				/>
			</div>

			<button
				type="submit"
				class="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
			>
				Unlock
			</button>
		</form>
	</div>
</div>
