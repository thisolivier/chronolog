<script lang="ts">
	let { data } = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-semibold text-gray-900">Admin</h1>
		<p class="mt-1 text-gray-600">Manage your client hierarchy and settings.</p>
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
