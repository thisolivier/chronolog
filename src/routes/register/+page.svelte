<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let errorMessage = $state('');
	let isLoading = $state(false);

	let passwordsMatch = $derived(password === confirmPassword);

	async function handleRegister() {
		errorMessage = '';

		if (!passwordsMatch) {
			errorMessage = 'Passwords do not match.';
			return;
		}

		if (password.length < 8) {
			errorMessage = 'Password must be at least 8 characters long.';
			return;
		}

		isLoading = true;

		try {
			const { error: signUpError } = await authClient.signUp.email({
				name,
				email,
				password
			});

			if (signUpError) {
				errorMessage = signUpError.message || 'Registration failed. Please try again.';
				isLoading = false;
				return;
			}

			goto('/login');
		} catch (_error) {
			errorMessage = 'An unexpected error occurred. Please try again.';
			isLoading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50">
	<div class="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
		<div class="text-center">
			<h1 class="text-3xl font-bold text-gray-900">Chronolog</h1>
			<p class="mt-2 text-gray-600">Create your account</p>
		</div>

		{#if errorMessage}
			<div class="rounded-md bg-red-50 p-4 text-sm text-red-700">
				{errorMessage}
			</div>
		{/if}

		<form onsubmit={handleRegister} class="space-y-6">
			<div>
				<label for="name" class="block text-sm font-medium text-gray-700">Name</label>
				<input
					id="name"
					type="text"
					bind:value={name}
					required
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					placeholder="Your name"
				/>
			</div>

			<div>
				<label for="email" class="block text-sm font-medium text-gray-700">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					required
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					placeholder="you@example.com"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium text-gray-700">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					required
					minlength="8"
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					placeholder="At least 8 characters"
				/>
			</div>

			<div>
				<label for="confirm-password" class="block text-sm font-medium text-gray-700">
					Confirm Password
				</label>
				<input
					id="confirm-password"
					type="password"
					bind:value={confirmPassword}
					required
					minlength="8"
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					placeholder="Repeat your password"
				/>
				{#if confirmPassword && !passwordsMatch}
					<p class="mt-1 text-sm text-red-600">Passwords do not match</p>
				{/if}
			</div>

			<button
				type="submit"
				disabled={isLoading || !passwordsMatch}
				class="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
			>
				{isLoading ? 'Creating account...' : 'Create account'}
			</button>
		</form>

		<p class="text-center text-sm text-gray-600">
			Already have an account?
			<a href="/login" class="font-medium text-blue-600 hover:text-blue-500">Sign in</a>
		</p>
	</div>
</div>
