<script lang="ts">
	import { onMount } from 'svelte';
	import { authClient } from '$lib/auth-client';
	import { clearDesktopTimer } from '$lib/desktop/bridge';

	// Sign-in only works through the script below; until it has hydrated, the submit buttons stay
	// disabled so a fast click can't fall back to a native GET submit to /login? (QA R1).
	let isHydrated = $state(false);

	onMount(() => {
		isHydrated = true;
		// Signed out (or the session expired): the desktop menu bar must not keep showing a timer
		clearDesktopTimer();
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

			// Full page load so the root layout's server data carries the signed-in user
			// (and the session cookie is in place for every request after it).
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

			// Full page load so the root layout's server data carries the signed-in user
			// (and the session cookie is in place for every request after it).
			window.location.href = '/';
		} catch (_error) {
			errorMessage = 'An unexpected error occurred. Please try again.';
			isLoading = false;
		}
	}
</script>

<svelte:head><title>Chronolog · Sign in</title></svelte:head>

<div class="safe-area-shell flex min-h-dvh items-center justify-center bg-chalk-50">
	<div class="w-[calc(100%-2rem)] max-w-md space-y-8 rounded-lg bg-surface p-6 shadow-md sm:p-8">
		<div class="text-center">
			<h1 class="text-3xl font-bold text-ink">Chronolog</h1>
			<p class="mt-2 text-ink-muted">
				{requiresTwoFactor ? 'Enter your 2FA code' : 'Sign in to your account'}
			</p>
		</div>

		{#if errorMessage}
			<div class="rounded-md bg-rust-50 p-4 text-sm text-rust-700">
				{errorMessage}
			</div>
		{/if}

		{#if requiresTwoFactor}
			<form onsubmit={handleTwoFactorVerification} class="space-y-6">
				<div>
					<label for="totp-code" class="block text-sm font-medium text-ink-soft">
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
						class="mt-1 block w-full rounded-md input-base px-3 py-2"
						placeholder="Enter 6-digit code"
					/>
				</div>

				<button
					type="submit"
					disabled={isLoading || !isHydrated}
					class="w-full rounded-md btn-primary px-4 py-2 disabled:opacity-50"
				>
					{isLoading ? 'Verifying...' : 'Verify'}
				</button>
			</form>
		{:else}
			<form onsubmit={handleLogin} class="space-y-6">
				<div>
					<label for="email" class="block text-sm font-medium text-ink-soft">Email</label>
					<input
						id="email"
						type="email"
						bind:value={email}
						required
						class="mt-1 block w-full rounded-md input-base px-3 py-2"
						placeholder="you@example.com"
					/>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-ink-soft">
						Password
					</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						required
						class="mt-1 block w-full rounded-md input-base px-3 py-2"
						placeholder="Your password"
					/>
				</div>

				<button
					type="submit"
					disabled={isLoading || !isHydrated}
					class="w-full rounded-md btn-primary px-4 py-2 disabled:opacity-50"
				>
					{isLoading ? 'Signing in...' : 'Sign in'}
				</button>
			</form>
		{/if}

		<p class="text-center text-sm text-ink-muted">
			Don't have an account?
			<a href="/register" class="font-medium text-pine-600 hover:text-pine-500">Register</a>
		</p>
	</div>
</div>
