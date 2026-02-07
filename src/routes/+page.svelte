<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let { data } = $props();

	async function handleLogout() {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					goto('/login');
				}
			}
		});
	}
</script>

<div class="min-h-screen bg-gray-50">
	<header class="border-b border-gray-200 bg-white shadow-sm">
		<div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
			<h1 class="text-xl font-bold text-gray-900">Chronolog</h1>
			<div class="flex items-center gap-4">
				<span class="text-sm text-gray-600">
					{data.user?.name || data.user?.email || 'User'}
				</span>
				<button
					onclick={handleLogout}
					class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
				>
					Sign out
				</button>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-7xl p-8">
		<div class="mb-8">
			<h2 class="text-2xl font-semibold text-gray-900">
				Welcome, {data.user?.name || 'there'}
			</h2>
			<p class="mt-1 text-gray-600">Time tracking and notes for consulting work.</p>
		</div>

		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			<a
				href="/admin"
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
			>
				<h3 class="font-semibold text-gray-900">Admin</h3>
				<p class="mt-2 text-sm text-gray-600">
					Manage clients, contracts, deliverables, and work types.
				</p>
			</a>
			<a
				href="/settings/two-factor"
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
			>
				<h3 class="font-semibold text-gray-900">Two-Factor Authentication</h3>
				<p class="mt-2 text-sm text-gray-600">
					Manage your 2FA settings and recovery codes.
				</p>
			</a>
		</div>
	</main>
</div>
