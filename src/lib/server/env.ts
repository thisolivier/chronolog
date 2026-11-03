/**
 * Server-only environment access.
 *
 * Reads runtime environment variables via `$env/dynamic/private` (so values come
 * from the process environment at server start, not from the build) and fails
 * fast with a clear message when a required secret is missing.
 *
 * `getServerEnvironment()` is called from `hooks.server.ts` at module scope so a
 * misconfigured deployment refuses to boot. During `vite build` (`building` is
 * true) secrets are optional because the Docker image is built without a `.env`.
 *
 * Variables:
 * - `BETTER_AUTH_SECRET` (required at runtime) — session signing secret
 * - `ENCRYPTION_KEY`     (required at runtime) — base64, 32 bytes; AES-256-GCM key for encryption at rest
 * - `DEVICE_ACCESS_KEY_HASH` (required when NODE_ENV=production) — scrypt hash of the device access
 *   key (`node scripts/generate-device-key.mjs`); unset in development disables the gate with a warning
 * - `BETTER_AUTH_URL`    (optional, default `http://localhost:5173`) — public base URL
 * - `ALLOW_REGISTRATION` (optional, default `false`) — `true` enables sign-up
 * - `TRUSTED_ORIGINS`    (optional) — comma-separated extra origins for Better Auth CSRF checks
 */

import { env as dynamicPrivateEnv } from '$env/dynamic/private';
import { building } from '$app/environment';
import { decodeEncryptionKey } from './crypto/field-encryption';
import { parseDeviceKeyHash } from './device-gate/device-key';

export const REQUIRED_SECRET_NAMES = ['BETTER_AUTH_SECRET', 'ENCRYPTION_KEY'] as const;
export const DEFAULT_BETTER_AUTH_URL = 'http://localhost:5173';

/**
 * Stands in for missing secrets while `vite build` analyses the server code.
 * Better Auth refuses its own default secret in production builds, so this must
 * be a distinct, long string; it is never used to serve a request.
 */
export const BUILD_TIME_PLACEHOLDER_SECRET = 'build-time-placeholder-secret-never-used-at-runtime';

export type EnvironmentSource = Record<string, string | undefined>;

export interface ServerEnvironment {
	betterAuthSecret: string;
	encryptionKey: string;
	/** Decoded ENCRYPTION_KEY (32 bytes); a throwaway key while building. */
	encryptionKeyBytes: Buffer;
	/** Configured scrypt hash, or null when the device gate is disabled (development only). */
	deviceAccessKeyHash: string | null;
	betterAuthUrl: string;
	allowRegistration: boolean;
	trustedOrigins: string[];
}

/** `true` (case-insensitive, trimmed) is the only truthy value; anything else is false. */
export function parseBooleanFlag(rawValue: string | undefined): boolean {
	return (rawValue ?? '').trim().toLowerCase() === 'true';
}

/**
 * Splits a comma-separated origin list, trims entries, drops empties and
 * duplicates, and always includes the Better Auth base URL itself.
 */
export function parseTrustedOrigins(rawList: string | undefined, betterAuthUrl: string): string[] {
	const configuredOrigins = (rawList ?? '')
		.split(',')
		.map((origin) => origin.trim())
		.filter((origin) => origin.length > 0);

	return Array.from(new Set([betterAuthUrl, ...configuredOrigins]));
}

/**
 * Builds a `ServerEnvironment` from a plain key/value source.
 * Throws an Error naming every missing required variable when
 * `requireSecrets` is true (the default); otherwise missing secrets take
 * `BUILD_TIME_PLACEHOLDER_SECRET`.
 */
export function parseServerEnvironment(
	source: EnvironmentSource,
	options: { requireSecrets?: boolean; isProduction?: boolean } = {}
): ServerEnvironment {
	const requireSecrets = options.requireSecrets ?? true;
	const isProduction = options.isProduction ?? false;

	const missingNames = REQUIRED_SECRET_NAMES.filter(
		(name) => (source[name] ?? '').trim().length === 0
	);

	if (requireSecrets && missingNames.length > 0) {
		throw new Error(
			`Missing required environment variable(s): ${missingNames.join(', ')}. ` +
				'Set them in .env (development) or the container environment (production) before starting Chronolog.'
		);
	}

	const betterAuthUrl = (source.BETTER_AUTH_URL ?? '').trim() || DEFAULT_BETTER_AUTH_URL;

	const readSecret = (name: (typeof REQUIRED_SECRET_NAMES)[number]): string =>
		missingNames.includes(name) ? BUILD_TIME_PLACEHOLDER_SECRET : (source[name] as string);

	const encryptionKey = readSecret('ENCRYPTION_KEY');
	// Validate the key's length whenever it is real; the build placeholder gets a throwaway key.
	const encryptionKeyBytes = missingNames.includes('ENCRYPTION_KEY')
		? Buffer.alloc(32)
		: decodeEncryptionKey(encryptionKey);

	const configuredHash = (source.DEVICE_ACCESS_KEY_HASH ?? '').trim();
	if (configuredHash.length === 0 && requireSecrets && isProduction) {
		throw new Error(
			'Missing required environment variable(s): DEVICE_ACCESS_KEY_HASH (required when NODE_ENV=production). ' +
				'Generate it with: node scripts/generate-device-key.mjs'
		);
	}
	if (configuredHash.length > 0) parseDeviceKeyHash(configuredHash); // throws on a malformed hash

	return {
		betterAuthSecret: readSecret('BETTER_AUTH_SECRET'),
		encryptionKey,
		encryptionKeyBytes,
		deviceAccessKeyHash: configuredHash.length > 0 ? configuredHash : null,
		betterAuthUrl,
		allowRegistration: parseBooleanFlag(source.ALLOW_REGISTRATION),
		trustedOrigins: parseTrustedOrigins(source.TRUSTED_ORIGINS, betterAuthUrl)
	};
}

let cachedEnvironment: ServerEnvironment | null = null;

/**
 * Returns the validated server environment, parsing it once per process.
 * Throws at first call when a required secret is missing — unless the app is
 * being built, in which case secrets are not available and not needed.
 */
export function getServerEnvironment(): ServerEnvironment {
	if (cachedEnvironment === null) {
		const isProduction = (dynamicPrivateEnv.NODE_ENV ?? process.env.NODE_ENV) === 'production';
		cachedEnvironment = parseServerEnvironment(dynamicPrivateEnv, {
			requireSecrets: !building,
			isProduction
		});
	}
	return cachedEnvironment;
}
