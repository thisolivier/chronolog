<script lang="ts">
	let { data } = $props();

	async function handleSignOut() {
		try {
			const response = await fetch('/api/auth/sign-out', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			if (response.ok) {
				window.location.href = '/login';
			}
		} catch {
			// If sign out fails, still redirect to login
			window.location.href = '/login';
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-gray-900">Admin</h1>
			<p class="mt-1 text-gray-600">Manage your client hierarchy and settings.</p>
		</div>

		<div class="flex items-center gap-4">
			{#if data.user}
				<span class="text-sm text-gray-600">{data.user.name || data.user.email}</span>
			{/if}
			<button
				onclick={handleSignOut}
				class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
			>
				Sign out
			</button>
		</div>
	</div>

	<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
		<a
			href="/admin/clients"
			class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
		>
			<h3 class="font-semibold text-gray-900">Clients</h3>
			<p class="mt-2 text-sm text-gray-600">
				Manage clients, contracts, deliverables, and work types.
			</p>
		</a>
	</div>
</div>
