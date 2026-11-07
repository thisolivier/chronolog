<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Chronolog · Unlock</title>
</svelte:head>

<div class="safe-area-shell flex min-h-dvh items-center justify-center bg-chalk-50">
	<div class="w-[calc(100%-2rem)] max-w-md space-y-8 rounded-lg bg-surface p-6 shadow-md sm:p-8">
		<div class="text-center">
			<h1 class="text-3xl font-bold text-ink">Chronolog</h1>
			<p class="mt-2 text-ink-muted">Enter this server's device access key</p>
		</div>

		{#if form?.error}
			<div class="rounded-md bg-rust-50 p-4 text-sm text-rust-700" role="alert">
				{form.error}
			</div>
		{/if}

		<!-- Plain POST (no enhance): works before hydration and keeps the key out of client JS state. -->
		<form method="POST" class="space-y-6">
			<div>
				<label for="device-key" class="block text-sm font-medium text-ink-soft">Device key</label>
				<input
					id="device-key"
					name="deviceKey"
					type="password"
					autocomplete="off"
					required
					class="mt-1 block w-full rounded-md input-base px-3 py-2"
					placeholder="Paste the key"
				/>
			</div>

			<button
				type="submit"
				class="w-full rounded-md btn-primary px-4 py-2"
			>
				Unlock
			</button>
		</form>
	</div>
</div>
