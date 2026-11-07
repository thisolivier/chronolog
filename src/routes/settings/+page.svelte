<script lang="ts">
	import { clearDesktopTimer } from '$lib/desktop/bridge';
	import { clearOfflineDataForSignOut } from '$lib/offline/offline-session.svelte';

	let { data } = $props();

	async function handleSignOut() {
		// Nothing cached offline outlives the session; unsent offline changes only go if confirmed
		const cleared = await clearOfflineDataForSignOut((count) =>
			window.confirm(
				`${count === 1 ? '1 change' : `${count} changes`} made offline ${count === 1 ? 'has' : 'have'} not reached the server yet. Sign out and discard ${count === 1 ? 'it' : 'them'}?`
			)
		);
		if (!cleared) return;
		clearDesktopTimer();
		try {
			await fetch('/api/auth/sign-out', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{}'
			});
		} finally {
			window.location.href = '/login';
		}
	}

	const sections = [
		{
			href: '/admin/clients',
			title: 'Clients and contracts',
			description: 'Add, rename, reorder, archive and delete clients, contracts, deliverables and work types.'
		},
		{
			href: '/settings/two-factor',
			title: 'Two-factor authentication',
			description: 'Protect sign-in with an authenticator app and recovery codes.'
		},
		{
			href: '/settings/api-tokens',
			title: 'API tokens',
			description: 'Personal tokens for the laptop CLI and Claude: create, see last use, revoke.'
		}
	];
</script>

<svelte:head><title>Chronolog · Settings</title></svelte:head>

<div class="space-y-6">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold text-ink">Settings</h1>
			<p class="mt-1 text-ink-muted">Your client hierarchy and account security.</p>
		</div>
		<div class="flex items-center gap-4">
			{#if data.user}
				<span class="text-sm text-ink-muted">{data.user.name || data.user.email}</span>
			{/if}
			<button
				onclick={handleSignOut}
				class="rounded-md btn-secondary px-3 py-1.5 text-sm"
			>
				Sign out
			</button>
		</div>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		{#each sections as section (section.href)}
			<a
				href={section.href}
				class="rounded-lg border border-divider bg-surface p-5 shadow-sm transition hover:shadow-md"
			>
				<h2 class="font-semibold text-ink">{section.title}</h2>
				<p class="mt-2 text-sm text-ink-muted">{section.description}</p>
			</a>
		{/each}
	</div>
</div>
