/**
 * Shared reactive timer state for cross-component communication.
 *
 * TimerWidget writes to this store via update()/reset();
 * TimerIndicator (in the AppShell top bar) reads from it.
 *
 * Uses the same Svelte 5 context pattern as navigation.svelte.ts.
 *
 * Inside the desktop app it also pushes the timer to the menu bar ($lib/desktop/bridge).
 */
import { getContext, setContext } from 'svelte';
import {
	createDesktopTimerPusher,
	isDesktopShell,
	toDesktopTimerState
} from '$lib/desktop/bridge';

const TIMER_STATE_KEY = Symbol('timer-state');

export interface TimerDisplayState {
	status: 'idle' | 'running' | 'paused' | 'stopped';
	elapsedSeconds: number;
	description: string;
	contractName: string;
	clientColorIndex: number;
	/** Client short code of the timer's contract, shown in the desktop menu bar */
	contractShortCode?: string;
	/** The capture's own identity (sprint 053-DR): contract name, its client, never the browsed one */
	contractTitle?: string;
	clientName?: string;
	/** Local start (`HH:MM:SS`) and date, so the header clock can tick with no widget mounted */
	startTime?: string;
	startDate?: string;
}

export interface TimerStateContext {
	// Reactive getters
	status: 'idle' | 'running' | 'paused' | 'stopped';
	elapsedSeconds: number;
	description: string;
	contractName: string;
	clientColorIndex: number;
	contractTitle: string;
	clientName: string;
	startTime: string;
	startDate: string;

	// Actions (called by TimerWidget)
	update: (newState: Partial<TimerDisplayState>) => void;
	reset: () => void;
}

/**
 * Create a new timer state instance.
 * Call this once from the root layout and set it in context.
 */
export function createTimerState(): TimerStateContext {
	const state = $state<TimerDisplayState>({
		status: 'idle',
		elapsedSeconds: 0,
		description: '',
		contractName: '',
		clientColorIndex: 0,
		contractShortCode: '',
		contractTitle: '',
		clientName: '',
		startTime: '',
		startDate: ''
	});

	// Desktop app only (src-tauri): mirror the timer into the menu bar. Browsers skip this.
	if (isDesktopShell()) {
		const desktopTimerPusher = createDesktopTimerPusher();
		$effect(() => {
			desktopTimerPusher.push(
				toDesktopTimerState(state.status, state.elapsedSeconds, state.contractShortCode ?? '')
			);
		});
		$effect(() => desktopTimerPusher.startHeartbeat());
	}

	return {
		get status() {
			return state.status;
		},
		get elapsedSeconds() {
			return state.elapsedSeconds;
		},
		get description() {
			return state.description;
		},
		get contractName() {
			return state.contractName;
		},
		get clientColorIndex() {
			return state.clientColorIndex;
		},
		get contractTitle() {
			return state.contractTitle ?? '';
		},
		get clientName() {
			return state.clientName ?? '';
		},
		get startTime() {
			return state.startTime ?? '';
		},
		get startDate() {
			return state.startDate ?? '';
		},

		update(newState: Partial<TimerDisplayState>) {
			Object.assign(state, newState);
		},

		reset() {
			state.status = 'idle';
			state.elapsedSeconds = 0;
			state.description = '';
			state.contractName = '';
			state.clientColorIndex = 0;
			state.contractShortCode = '';
			state.contractTitle = '';
			state.clientName = '';
			state.startTime = '';
			state.startDate = '';
		}
	};
}

/**
 * Set the timer state in Svelte context.
 * Call this from the root layout after creating the state.
 */
export function setTimerStateContext(timerState: TimerStateContext): void {
	setContext(TIMER_STATE_KEY, timerState);
}

/**
 * Get the timer state from Svelte context.
 * Call this from any component that needs access to timer display state.
 *
 * @throws Error if called outside of a component that has timer state context set
 */
export function getTimerStateContext(): TimerStateContext {
	const context = getContext<TimerStateContext>(TIMER_STATE_KEY);
	if (!context) {
		throw new Error(
			'Timer state context not found. Make sure setTimerStateContext() is called in the root layout.'
		);
	}
	return context;
}
