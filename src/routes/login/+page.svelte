<script lang="ts">
	import { onMount } from 'svelte';
	import { authClient } from '$lib/auth-client';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Sign-in only works through the script below; until it has hydrated, the submit buttons stay
	// disabled so a fast click can't fall back to a native GET submit to /login? (QA R1).
	let isHydrated = $state(false);

	onMount(() => {
		isHydrated = true;
		// Reached /login by client-side navigation while already signed in (see
		// +page.server.ts). Full page reload so the root layout re-mounts with the
		// authenticated user and initializes navigation context.
		if (data.alreadyAuthenticated) {
			window.location.replace('/');
		}
	});

	let email = $state('');
	let password = $state('');
	let totpCode = $state('');
	let errorMessage = $state('');
	let isLoading = $state(false);
	let requiresTwoFactor = $state(false);

	async function handleLogin(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		isLoading = true;

		try {
			const { data: signInData, error: signInError } = await authClient.signIn.email({
				email,
				password
			});

			if (signInError) {
				errorMessage = signInError.message || 'Login failed. Please check your credentials.';
				isLoading = false;
				return;
			}

			// Better Auth's two-factor plugin answers a password sign-in with
			// { twoFactorRedirect: true } (no session yet) when 2FA is enabled.
			const twoFactorPending =
				(signInData as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect === true ||
				(signInData as { redirect?: boolean } | null)?.redirect === true;
			if (twoFactorPending) {
				requiresTwoFactor = true;
				isLoading = false;
				return;
			}

			// Full page reload so the root layout re-mounts with the
			// authenticated user and initializes navigation context.
			window.location.href = '/';
		} catch (_error) {
			errorMessage = 'An unexpected error occurred. Please try again.';
			isLoading = false;
		}
	}

	async function handleTwoFactorVerification(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		isLoading = true;

		try {
			const { error: verifyError } = await authClient.twoFactor.verifyTotp({
				code: totpCode
			});

			if (verifyError) {
				errorMessage = verifyError.message || 'Invalid 2FA code. Please try again.';
				isLoading = false;
				return;
			}

			// Full page reload so the root layout re-mounts with the
			// authenticated user and initializes navigation context.
			window.location.href = '/';
		} catch (_error) {
			errorMessage = 'An unexpected error occurred. Please try again.';
			isLoading = false;
		}
	}
</script>

<svelte:head><title>Chronolog · Sign in</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-stone-50">
	<div class="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
		<div class="text-center">
			<h1 class="text-3xl font-bold text-stone-900">Chronolog</h1>
			<p class="mt-2 text-stone-600">
				{requiresTwoFactor ? 'Enter your 2FA code' : 'Sign in to your account'}
			</p>
		</div>

		{#if errorMessage}
			<div class="rounded-md bg-red-50 p-4 text-sm text-red-700">
				{errorMessage}
			</div>
		{/if}

		{#if requiresTwoFactor}
			<form onsubmit={handleTwoFactorVerification} class="space-y-6">
				<div>
					<label for="totp-code" class="block text-sm font-medium text-stone-700">
						Authentication Code
					</label>
					<input
						id="totp-code"
						type="text"
						inputmode="numeric"
						autocomplete="one-time-code"
						maxlength="6"
						bind:value={totpCode}
						required
						class="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						placeholder="Enter 6-digit code"
					/>
				</div>

				<button
					type="submit"
					disabled={isLoading || !isHydrated}
					class="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
				>
					{isLoading ? 'Verifying...' : 'Verify'}
				</button>
			</form>
		{:else}
			<form onsubmit={handleLogin} class="space-y-6">
				<div>
					<label for="email" class="block text-sm font-medium text-stone-700">Email</label>
					<input
						id="email"
						type="email"
						bind:value={email}
						required
						class="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						placeholder="you@example.com"
					/>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-stone-700">
						Password
					</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						required
						class="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						placeholder="Your password"
					/>
				</div>

				<button
					type="submit"
					disabled={isLoading || !isHydrated}
					class="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
				>
					{isLoading ? 'Signing in...' : 'Sign in'}
				</button>
			</form>
		{/if}

		<p class="text-center text-sm text-stone-600">
			Don't have an account?
			<a href="/register" class="font-medium text-blue-600 hover:text-blue-500">Register</a>
		</p>
	</div>
</div>
