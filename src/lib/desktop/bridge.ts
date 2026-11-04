/**
 * Desktop bridge: pushes the running timer to the macOS menu-bar app (src-tauri).
 *
 * Inside the Tauri shell, `app.withGlobalTauri` exposes `window.__TAURI__`; in a browser it is
 * absent and every function here is a no-op. The shell grants the production origin exactly one
 * command, `set_timer_state`, which takes `{ running, startedAt, contractShortCode }`.
 */

export interface DesktopTimerState {
	running: boolean;
	/** Start of the running timer, milliseconds since the Unix epoch; null when not running */
	startedAt: number | null;
	/** Client short code of the timer's contract; empty while none is chosen */
	contractShortCode: string;
}

type InvokeFunction = (command: string, payload: Record<string, unknown>) => Promise<unknown>;

interface TauriGlobal {
	core?: { invoke?: InvokeFunction };
}

/** Starts that differ by this little are the same start (elapsed seconds tick with jitter) */
const START_TOLERANCE_MILLISECONDS = 2000;
export const HEARTBEAT_MILLISECONDS = 60_000;

function findInvoke(): InvokeFunction | null {
	if (typeof window === 'undefined') return null;
	const tauriGlobal = (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__;
	const invoke = tauriGlobal?.core?.invoke;
	return typeof invoke === 'function' ? invoke : null;
}

export function isDesktopShell(): boolean {
	return findInvoke() !== null;
}

/** The menu-bar state for a timer status and elapsed time, anchored at `now` */
export function toDesktopTimerState(
	status: string,
	elapsedSeconds: number,
	contractShortCode: string,
	now: number = Date.now()
): DesktopTimerState {
	if (status !== 'running') return { running: false, startedAt: null, contractShortCode: '' };
	return {
		running: true,
		startedAt: Math.round((now - elapsedSeconds * 1000) / 1000) * 1000,
		contractShortCode
	};
}

function isSameState(previous: DesktopTimerState | null, next: DesktopTimerState): boolean {
	if (!previous) return false;
	if (previous.running !== next.running) return false;
	if (previous.contractShortCode !== next.contractShortCode) return false;
	if (previous.startedAt === null || next.startedAt === null) return previous.startedAt === next.startedAt;
	return Math.abs(previous.startedAt - next.startedAt) <= START_TOLERANCE_MILLISECONDS;
}

/**
 * Sends timer state to the shell when it changes, and resends the last state on a heartbeat.
 * The heartbeat resends what was last computed (never recomputes the start), so a page where
 * the timer widget is not mounted cannot drift the start time.
 */
export function createDesktopTimerPusher() {
	let lastSentState: DesktopTimerState | null = null;

	function send(state: DesktopTimerState): void {
		const invoke = findInvoke();
		if (!invoke) return;
		lastSentState = state;
		try {
			invoke('set_timer_state', { ...state }).catch(() => {
				// Best effort: the shell may be mid-reload or the command denied
			});
		} catch {
			// Best effort, as above
		}
	}

	/** Resend the last state (the once-a-minute heartbeat) */
	function resend(): void {
		if (lastSentState) send(lastSentState);
	}

	return {
		/** Push if the state differs from the last one sent */
		push(state: DesktopTimerState): void {
			if (isSameState(lastSentState, state)) return;
			send(state);
		},
		resend,
		/** Start the heartbeat; returns its stop function */
		startHeartbeat(intervalMilliseconds: number = HEARTBEAT_MILLISECONDS): () => void {
			const intervalId = setInterval(resend, intervalMilliseconds);
			return () => clearInterval(intervalId);
		}
	};
}

/**
 * Clear the menu-bar timer: called on sign-out and when the sign-in page loads (a session that
 * expired, or a sign-out from another tab), so the menu bar never shows a signed-out user's timer.
 * A no-op outside the desktop shell.
 */
export function clearDesktopTimer(): void {
	const invoke = findInvoke();
	if (!invoke) return;
	try {
		invoke('set_timer_state', { running: false, startedAt: null, contractShortCode: '' }).catch(() => {
			// Best effort: the page is about to navigate away
		});
	} catch {
		// Best effort, as above
	}
}
