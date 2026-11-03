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
 * - `ENCRYPTION_KEY`     (required at runtime) — 256-bit key for encryption at rest
 * - `BETTER_AUTH_URL`    (optional, default `http://localhost:5173`) — public base URL
 * - `ALLOW_REGISTRATION` (optional, default `false`) — `true` enables sign-up
 * - `TRUSTED_ORIGINS`    (optional) — comma-separated extra origins for Better Auth CSRF checks
 */

import { env as dynamicPrivateEnv } from '$env/dynamic/private';
import { building } from '$app/environment';

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
	options: { requireSecrets?: boolean } = {}
): ServerEnvironment {
	const requireSecrets = options.requireSecrets ?? true;

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

	return {
		betterAuthSecret: readSecret('BETTER_AUTH_SECRET'),
		encryptionKey: readSecret('ENCRYPTION_KEY'),
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
		cachedEnvironment = parseServerEnvironment(dynamicPrivateEnv, { requireSecrets: !building });
	}
	return cachedEnvironment;
}
