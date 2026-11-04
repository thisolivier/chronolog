/**
 * Device access gate, run first in `hooks.server.ts` (before any session or DB lookup).
 *
 * A request passes when it carries the `chronolog_device` cookie set by `/unlock`, or an
 * `X-Device-Key` header whose value matches DEVICE_ACCESS_KEY_HASH. Otherwise pages get a
 * 303 to `/unlock` and `/api/*` gets 401 JSON. Wrong keys count towards a per-IP lockout.
 * Logs carry the client IP and path only, never key material.
 */

import { json, redirect, type RequestEvent } from '@sveltejs/kit';
import { getServerEnvironment } from '$lib/server/env';
import { keyFingerprint, verifyDeviceCookie, verifyDeviceKey } from './device-key';
import { createLockoutTracker } from './lockout';

export const DEVICE_COOKIE_NAME = 'chronolog_device';
export const DEVICE_KEY_HEADER = 'x-device-key';
export const DEVICE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Paths reachable without a device key: the unlock page, its assets, the PWA manifest, its icons
 * and the SW. In production adapter-node serves `static/` before the hooks run; this list keeps
 * dev the same, and lets Add to Home Screen fetch the icons from the unlock page.
 */
const exemptExactPaths = new Set([
	'/unlock',
	'/manifest.webmanifest',
	'/apple-touch-icon.png',
	'/pwa-192x192.png',
	'/pwa-512x512.png',
	'/favicon.png',
	'/sw.js',
	'/service-worker.js'
]);
const exemptPathPrefixes = ['/_app/'];

export function isGateExemptPath(pathname: string): boolean {
	return exemptExactPaths.has(pathname) || exemptPathPrefixes.some((prefix) => pathname.startsWith(prefix));
}

const lockout = createLockoutTracker();
/** Fingerprints of header keys already verified, so scrypt runs once per key per process. */
const verifiedKeyFingerprints = new Set<string>();

export function clientIpAddress(event: RequestEvent): string {
	const cloudflareIp = event.request.headers.get('cf-connecting-ip')?.trim();
	if (cloudflareIp) return cloudflareIp;
	try {
		return event.getClientAddress();
	} catch {
		return 'unknown';
	}
}

export type KeyAttemptResult = 'accepted' | 'rejected' | 'locked';

/**
 * Checks a presented raw key against the configured hash, applying the lockout and logging.
 * Shared by the header check and the unlock form action.
 */
export function attemptDeviceKey(presentedKey: string, clientIp: string, pathname: string): KeyAttemptResult {
	const configuredHash = getServerEnvironment().deviceAccessKeyHash;
	if (configuredHash === null) return 'accepted';

	if (lockout.isLocked(clientIp)) {
		console.warn(`[device-gate] locked IP attempted a key ip=${clientIp} path=${pathname}`);
		return 'locked';
	}

	const fingerprint = keyFingerprint(presentedKey);
	if (verifiedKeyFingerprints.has(fingerprint) || verifyDeviceKey(presentedKey, configuredHash)) {
		verifiedKeyFingerprints.add(fingerprint);
		lockout.recordSuccess(clientIp);
		return 'accepted';
	}

	const triggeredLock = lockout.recordFailure(clientIp);
	console.warn(`[device-gate] wrong device key ip=${clientIp} path=${pathname}`);
	if (triggeredLock) {
		const lockMinutes = Math.round(lockout.lockDurationMs / 60000);
		console.warn(`[device-gate] LOCKOUT ip=${clientIp} path=${pathname} for ${lockMinutes} minutes`);
		return 'locked';
	}
	return 'rejected';
}

export function hasValidDeviceCookie(event: RequestEvent): boolean {
	const configuredHash = getServerEnvironment().deviceAccessKeyHash;
	if (configuredHash === null) return true;
	const cookieValue = event.cookies.get(DEVICE_COOKIE_NAME);
	return cookieValue !== undefined && verifyDeviceCookie(cookieValue, configuredHash);
}

/**
 * Returns `null` when the request may proceed, or the Response that ends it.
 * Throws a SvelteKit redirect for page requests.
 */
export function enforceDeviceGate(event: RequestEvent): Response | null {
	if (getServerEnvironment().deviceAccessKeyHash === null) return null;

	const pathname = event.url.pathname;
	if (isGateExemptPath(pathname)) return null;
	if (hasValidDeviceCookie(event)) return null;

	const isApi = pathname === '/api' || pathname.startsWith('/api/');
	const headerKey = event.request.headers.get(DEVICE_KEY_HEADER);
	if (headerKey !== null) {
		const result = attemptDeviceKey(headerKey, clientIpAddress(event), pathname);
		if (result === 'accepted') return null;
		if (result === 'locked') {
			return json({ error: 'Too many failed device key attempts; try again later' }, { status: 429 });
		}
	}

	if (isApi) return json({ error: 'Device not authorised' }, { status: 401 });
	redirect(303, '/unlock');
}
