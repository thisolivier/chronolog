/**
 * Online Status — Reactive Network Connectivity Detection
 *
 * Provides a Svelte 5 runes-based reactive signal that tracks whether
 * the browser is currently online or offline. Listens to the `online`
 * and `offline` window events and exposes state via `$state`.
 *
 * Usage:
 *   const status = createOnlineStatus();
 *   // In a Svelte component: {status.isOnline ? 'Online' : 'Offline'}
 *   // Clean up when done: status.destroy();
 */

// ---------------------------------------------------------------------------
// OnlineStatus type
// ---------------------------------------------------------------------------

export interface OnlineStatus {
	/** Whether the browser reports network connectivity. */
	readonly isOnline: boolean;
	/** ISO timestamp of the last time the status transitioned to online. */
	readonly lastOnlineAt: string | null;
	/** Remove event listeners and clean up. */
	destroy(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a reactive online status tracker.
 *
 * Uses `navigator.onLine` for the initial state and listens to the
 * `online` / `offline` events on `window` for real-time updates.
 * The returned object exposes Svelte 5 `$state` properties.
 *
 * Call `destroy()` when the tracker is no longer needed to remove
 * the event listeners.
 */
export function createOnlineStatus(): OnlineStatus {
	const isBrowser =
		typeof window !== 'undefined' && typeof navigator !== 'undefined';

	let currentIsOnline = $state(isBrowser ? navigator.onLine : true);
	let currentLastOnlineAt = $state<string | null>(
		isBrowser && navigator.onLine ? new Date().toISOString() : null
	);

	function handleOnline() {
		currentIsOnline = true;
		currentLastOnlineAt = new Date().toISOString();
	}

	function handleOffline() {
		currentIsOnline = false;
	}

	if (isBrowser) {
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
	}

	return {
		get isOnline() {
			return currentIsOnline;
		},
		get lastOnlineAt() {
			return currentLastOnlineAt;
		},
		destroy() {
			if (isBrowser) {
				window.removeEventListener('online', handleOnline);
				window.removeEventListener('offline', handleOffline);
			}
		}
	};
}
