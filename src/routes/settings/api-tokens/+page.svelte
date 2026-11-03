<script lang="ts">
	/**
	 * Personal API tokens for the laptop CLI (sprint 028-CL): create (raw token shown once),
	 * list with last use, revoke. Calls /api/tokens with the browser session.
	 */
	import { onMount } from 'svelte';

	type TokenSummary = {
		id: string;
		name: string;
		createdAt: string;
		lastUsedAt: string | null;
		revokedAt: string | null;
	};

	let tokens = $state<TokenSummary[]>([]);
	let newTokenName = $state('');
	let createdRawToken = $state('');
	let createdTokenName = $state('');
	let errorMessage = $state('');
	let isBusy = $state(false);
	let hasCopied = $state(false);

	async function readError(response: Response): Promise<string> {
		const body = await response.json().catch(() => null);
		return body?.error ?? `Request failed (${response.status})`;
	}

	async function loadTokens() {
		const response = await fetch('/api/tokens');
		if (!response.ok) {
			errorMessage = await readError(response);
			return;
		}
		tokens = (await response.json()).tokens;
	}

	async function createToken(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		isBusy = true;
		try {
			const response = await fetch('/api/tokens', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newTokenName })
			});
			if (!response.ok) {
				errorMessage = await readError(response);
				return;
			}
			const body = await response.json();
			createdRawToken = body.rawToken;
			createdTokenName = body.token.name;
			hasCopied = false;
			newTokenName = '';
			await loadTokens();
		} finally {
			isBusy = false;
		}
	}

	async function revokeToken(token: TokenSummary) {
		if (!confirm(`Revoke “${token.name}”? Anything using it gets 403 from now on.`)) return;
		errorMessage = '';
		const response = await fetch(`/api/tokens/${token.id}`, { method: 'DELETE' });
		if (!response.ok) errorMessage = await readError(response);
		await loadTokens();
	}

	async function copyToken() {
		await navigator.clipboard.writeText(createdRawToken);
		hasCopied = true;
	}

	function dismissCreatedToken() {
		createdRawToken = '';
		createdTokenName = '';
	}

	function formatWhen(value: string | null): string {
		return value ? new Date(value).toLocaleString() : 'never';
	}

	onMount(loadTokens);
</script>

<svelte:head><title>Chronolog · API tokens</title></svelte:head>

<div class="mx-auto max-w-2xl">
	<nav class="mb-6 flex items-center gap-2 text-sm text-stone-500" aria-label="Breadcrumb">
		<a href="/settings" class="hover:text-stone-700">Settings</a>
		<span class="text-stone-400">/</span>
		<span class="font-medium text-stone-900">API tokens</span>
	</nav>

	<h1 class="mb-2 text-2xl font-bold text-stone-900">API tokens</h1>
	<p class="mb-8 text-stone-600">
		A token lets the <code class="rounded bg-stone-100 px-1">chronolog</code> CLI (and Claude on your
		laptop) act as you through the API. It does not replace the device key: requests still need the
		<code class="rounded bg-stone-100 px-1">X-Device-Key</code> header. Create one per laptop and revoke
		it if the laptop is lost.
	</p>

	{#if errorMessage}
		<div class="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700" role="alert">{errorMessage}</div>
	{/if}

	{#if createdRawToken}
		<div class="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-5" data-testid="created-token">
			<p class="mb-2 font-medium text-amber-900">
				Copy the token for “{createdTokenName}” now. It is not shown again.
			</p>
			<div class="flex flex-wrap items-center gap-2">
				<code
					class="block min-w-0 flex-1 overflow-x-auto rounded border border-amber-200 bg-white px-3 py-2 font-mono text-sm break-all text-stone-900"
					data-testid="raw-token">{createdRawToken}</code
				>
				<button
					type="button"
					onclick={copyToken}
					class="rounded-md bg-amber-600 px-3 py-2 text-sm text-white hover:bg-amber-700"
				>
					{hasCopied ? 'Copied' : 'Copy'}
				</button>
				<button
					type="button"
					onclick={dismissCreatedToken}
					class="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-amber-900 hover:bg-amber-100"
				>
					Done
				</button>
			</div>
			<p class="mt-3 text-sm text-amber-900">
				On the laptop: <code class="rounded bg-white px-1">chronolog init</code> and paste it when asked.
			</p>
		</div>
	{/if}

	<form onsubmit={createToken} class="mb-8 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
		<label for="token-name" class="block text-sm font-medium text-stone-700">New token name</label>
		<div class="mt-1 flex flex-wrap gap-2">
			<input
				id="token-name"
				type="text"
				bind:value={newTokenName}
				maxlength="80"
				placeholder="MacBook CLI"
				class="block min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
			/>
			<button
				type="submit"
				disabled={isBusy || newTokenName.trim() === ''}
				class="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
			>
				Create token
			</button>
		</div>
	</form>

	<h2 class="mb-3 font-semibold text-stone-900">Your tokens</h2>
	{#if tokens.length === 0}
		<p class="text-sm text-stone-500">No tokens yet.</p>
	{:else}
		<ul class="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white" data-testid="token-list">
			{#each tokens as token (token.id)}
				<li class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
					<div class="min-w-0">
						<p class="font-medium text-stone-900">
							{token.name}
							{#if token.revokedAt}
								<span class="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-xs text-stone-600">revoked</span>
							{/if}
						</p>
						<p class="text-xs text-stone-500">
							Created {formatWhen(token.createdAt)} · last used {formatWhen(token.lastUsedAt)}
							{#if token.revokedAt}· revoked {formatWhen(token.revokedAt)}{/if}
						</p>
					</div>
					{#if !token.revokedAt}
						<button
							type="button"
							onclick={() => revokeToken(token)}
							class="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
						>
							Revoke
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
