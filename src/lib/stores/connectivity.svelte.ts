/**
 * App-wide connectivity (sprint 026-CL, finding 3). Offline means either the browser says so
 * (`navigator.onLine`, `offline` event) or the last API request failed at the network level —
 * the server can be unreachable while the browser still thinks it is online.
 *
 * `fetch-helpers.ts` reports request outcomes; `ConnectionStatus.svelte` renders the banner.
 */

const BACK_ONLINE_NOTICE_MS = 3000;

class ConnectivityState {
	browserOnline = $state(true);
	serverUnreachable = $state(false);
	/** True for a few seconds after reconnecting, so the banner can say "Back online". */
	recentlyReconnected = $state(false);

	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	get isOffline(): boolean {
		return !this.browserOnline || this.serverUnreachable;
	}

	setBrowserOnline(online: boolean): void {
		const wasOffline = this.isOffline;
		this.browserOnline = online;
		// A fresh `online` event clears a stale request failure; the next request re-checks.
		if (online) this.serverUnreachable = false;
		this.noteTransition(wasOffline);
	}

	reportNetworkFailure(): void {
		const wasOffline = this.isOffline;
		this.serverUnreachable = true;
		this.noteTransition(wasOffline);
	}

	reportNetworkSuccess(): void {
		if (!this.serverUnreachable) return;
		const wasOffline = this.isOffline;
		this.serverUnreachable = false;
		this.noteTransition(wasOffline);
	}

	private noteTransition(wasOffline: boolean): void {
		if (this.isOffline) {
			this.recentlyReconnected = false;
			if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
			return;
		}
		if (wasOffline) {
			this.recentlyReconnected = true;
			if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
			this.reconnectTimer = setTimeout(() => (this.recentlyReconnected = false), BACK_ONLINE_NOTICE_MS);
		}
	}
}

export const connectivity = new ConnectivityState();

/** Follow the browser's online/offline events; returns the cleanup for `$effect`. */
export function trackBrowserConnectivity(): () => void {
	connectivity.setBrowserOnline(navigator.onLine);
	const handleOnline = () => connectivity.setBrowserOnline(true);
	const handleOffline = () => connectivity.setBrowserOnline(false);
	window.addEventListener('online', handleOnline);
	window.addEventListener('offline', handleOffline);
	return () => {
		window.removeEventListener('online', handleOnline);
		window.removeEventListener('offline', handleOffline);
	};
}
