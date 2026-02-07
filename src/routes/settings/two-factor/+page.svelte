<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import QRCode from 'qrcode';

	let currentPassword = $state('');
	let verificationCode = $state('');
	let disablePassword = $state('');
	let errorMessage = $state('');
	let successMessage = $state('');
	let isLoading = $state(false);

	/** The current step in the 2FA enrollment flow */
	let enrollmentStep = $state<'idle' | 'qr-display' | 'recovery-codes'>('idle');

	/** The TOTP URI returned from the server, used to generate the QR code */
	let totpUri = $state('');

	/** Data URL for the QR code image */
	let qrCodeDataUrl = $state('');

	/** Recovery codes shown after successful enrollment */
	let recoveryCodes = $state<string[]>([]);

	/** Whether the user currently has 2FA enabled */
	let hasTwoFactorEnabled = $state(false);

	const session = authClient.useSession();

	// Check if user has 2FA enabled from session data
	$effect(() => {
		const currentSession = session.get();
		if (currentSession?.data?.user) {
			const userRecord = currentSession.data.user as Record<string, unknown>;
			hasTwoFactorEnabled = userRecord.twoFactorEnabled === true;
		}
	});

	/**
	 * Step 1: Enable 2FA and get the TOTP URI for QR code display.
	 * This calls enable() to set up the 2FA secret on the server,
	 * then getTotpURI() to get the URI for the QR code.
	 */
	async function startEnrollment() {
		errorMessage = '';
		successMessage = '';
		isLoading = true;

		try {
			// First enable 2FA - this stores the secret and generates backup codes
			const enableResult = await authClient.twoFactor.enable({
				password: currentPassword
			});

			if (enableResult.error) {
				errorMessage = enableResult.error.message || 'Failed to enable 2FA.';
				isLoading = false;
				return;
			}

			// Extract backup codes from enable response
			if (enableResult.data?.backupCodes) {
				recoveryCodes = enableResult.data.backupCodes;
			}

			// Get the TOTP URI for QR code scanning
			const uriResult = await authClient.twoFactor.getTotpUri({
				password: currentPassword
			});

			if (uriResult.error) {
				errorMessage = uriResult.error.message || 'Failed to generate QR code.';
				isLoading = false;
				return;
			}

			if (uriResult.data?.totpURI) {
				totpUri = uriResult.data.totpURI;
				qrCodeDataUrl = await QRCode.toDataURL(totpUri, {
					width: 256,
					margin: 2
				});
				enrollmentStep = 'qr-display';
			}
		} catch (unexpectedError) {
			errorMessage = 'An unexpected error occurred. Please try again.';
		}

		isLoading = false;
	}

	/**
	 * Step 2: Verify the TOTP code from the authenticator app
	 * to confirm the user has set it up correctly.
	 */
	async function verifySetup() {
		errorMessage = '';
		isLoading = true;

		try {
			const verifyResult = await authClient.twoFactor.verifyTotp({
				code: verificationCode
			});

			if (verifyResult.error) {
				errorMessage = verifyResult.error.message || 'Invalid code. Please try again.';
				isLoading = false;
				return;
			}

			hasTwoFactorEnabled = true;
			enrollmentStep = 'recovery-codes';
			successMessage = 'Two-factor authentication has been enabled.';
		} catch (unexpectedError) {
			errorMessage = 'An unexpected error occurred. Please try again.';
		}

		isLoading = false;
	}

	/** Disable 2FA for the current user. */
	async function disableTwoFactor() {
		errorMessage = '';
		successMessage = '';
		isLoading = true;

		try {
			const { error } = await authClient.twoFactor.disable({
				password: disablePassword
			});

			if (error) {
				errorMessage = error.message || 'Failed to disable 2FA.';
				isLoading = false;
				return;
			}

			hasTwoFactorEnabled = false;
			enrollmentStep = 'idle';
			disablePassword = '';
			successMessage = 'Two-factor authentication has been disabled.';
		} catch (unexpectedError) {
			errorMessage = 'An unexpected error occurred. Please try again.';
		}

		isLoading = false;
	}

	/** Reset the enrollment flow to the initial state. */
	function resetFlow() {
		enrollmentStep = 'idle';
		currentPassword = '';
		verificationCode = '';
		totpUri = '';
		qrCodeDataUrl = '';
		recoveryCodes = [];
		errorMessage = '';
		successMessage = '';
	}
</script>

<div class="mx-auto max-w-2xl p-8">
	<div class="mb-8">
		<a href="/" class="text-sm text-blue-600 hover:text-blue-500">&larr; Back to dashboard</a>
	</div>

	<h1 class="mb-2 text-2xl font-bold text-gray-900">Two-Factor Authentication</h1>
	<p class="mb-8 text-gray-600">
		Add an extra layer of security to your account using a TOTP authenticator app.
	</p>

	{#if errorMessage}
		<div class="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700">
			{errorMessage}
		</div>
	{/if}

	{#if successMessage}
		<div class="mb-6 rounded-md bg-green-50 p-4 text-sm text-green-700">
			{successMessage}
		</div>
	{/if}

	{#if hasTwoFactorEnabled && enrollmentStep === 'idle'}
		{@render twoFactorEnabledView()}
	{:else if enrollmentStep === 'idle'}
		{@render enrollmentStartView()}
	{:else if enrollmentStep === 'qr-display'}
		{@render qrCodeView()}
	{:else if enrollmentStep === 'recovery-codes'}
		{@render recoveryCodesView()}
	{/if}
</div>

{#snippet twoFactorEnabledView()}
	<div class="rounded-lg border border-green-200 bg-green-50 p-6">
		<div class="mb-4 flex items-center gap-2">
			<span class="inline-block h-3 w-3 rounded-full bg-green-500"></span>
			<span class="font-medium text-green-800">Two-factor authentication is enabled</span>
		</div>

		<p class="mb-6 text-sm text-gray-600">
			To disable 2FA, enter your password below.
		</p>

		<div class="space-y-4">
			<div>
				<label for="disable-password" class="block text-sm font-medium text-gray-700">
					Password
				</label>
				<input
					id="disable-password"
					type="password"
					bind:value={disablePassword}
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					placeholder="Enter your password"
				/>
			</div>

			<button
				onclick={disableTwoFactor}
				disabled={isLoading || !disablePassword}
				class="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
			>
				{isLoading ? 'Disabling...' : 'Disable 2FA'}
			</button>
		</div>
	</div>
{/snippet}

{#snippet enrollmentStartView()}
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<p class="mb-6 text-sm text-gray-600">
			Use an authenticator app like Google Authenticator, Authy, or 1Password to scan a QR code.
		</p>

		<div class="space-y-4">
			<div>
				<label for="current-password" class="block text-sm font-medium text-gray-700">
					Password
				</label>
				<input
					id="current-password"
					type="password"
					bind:value={currentPassword}
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					placeholder="Enter your password to begin"
				/>
			</div>

			<button
				onclick={startEnrollment}
				disabled={isLoading || !currentPassword}
				class="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
			>
				{isLoading ? 'Setting up...' : 'Enable 2FA'}
			</button>
		</div>
	</div>
{/snippet}

{#snippet qrCodeView()}
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">Scan the QR Code</h2>

		<p class="mb-4 text-sm text-gray-600">
			Scan this QR code with your authenticator app, then enter the 6-digit code below to verify.
		</p>

		<div class="mb-6 flex justify-center">
			{#if qrCodeDataUrl}
				<img src={qrCodeDataUrl} alt="TOTP QR Code" class="rounded-lg" width="256" height="256" />
			{/if}
		</div>

		<details class="mb-6">
			<summary class="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
				Cannot scan? Enter the URI manually
			</summary>
			<code class="mt-2 block break-all rounded-md bg-gray-100 p-3 text-xs text-gray-700">
				{totpUri}
			</code>
		</details>

		<div class="space-y-4">
			<div>
				<label for="verification-code" class="block text-sm font-medium text-gray-700">
					Verification Code
				</label>
				<input
					id="verification-code"
					type="text"
					inputmode="numeric"
					autocomplete="one-time-code"
					maxlength="6"
					bind:value={verificationCode}
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					placeholder="Enter 6-digit code"
				/>
			</div>

			<div class="flex gap-3">
				<button
					onclick={verifySetup}
					disabled={isLoading || verificationCode.length !== 6}
					class="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
				>
					{isLoading ? 'Verifying...' : 'Verify & Enable'}
				</button>

				<button
					onclick={resetFlow}
					class="rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/snippet}

{#snippet recoveryCodesView()}
	<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
		<h2 class="mb-2 text-lg font-semibold text-gray-900">Save Your Recovery Codes</h2>

		<p class="mb-4 text-sm text-gray-600">
			These recovery codes can be used to access your account if you lose your authenticator device.
			Each code can only be used once. <strong>Save them in a secure location.</strong>
		</p>

		<div class="mb-6 rounded-md bg-white p-4 font-mono text-sm">
			{#each recoveryCodes as recoveryCode}
				<div class="py-1 text-gray-800">{recoveryCode}</div>
			{/each}
		</div>

		<button
			onclick={resetFlow}
			class="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
		>
			I have saved my codes
		</button>
	</div>
{/snippet}
