/**
 * Split time: which actions are available in each stage (SP-04, SP-05, SP-06) and what a crossing
 * into the small layout does (SP-07). Pure; the session is `split-session.svelte.ts`.
 *
 * Phases: `editing` (left unresolved) → `left-saving` (the split request in flight) → `resolved`
 * (left saved or discarded; the right is finished through Save, Discard or Resume) → `right-busy`
 * (a right action in flight) → `closed`.
 */
export type SplitPhase = 'closed' | 'editing' | 'left-saving' | 'resolved' | 'right-busy';

export type SplitActions = {
	/** Left Save and Discard */
	leftResolve: boolean;
	/** Right Stop (only while the right is live) */
	rightStop: boolean;
	/** Right Save, Discard and Resume */
	rightResolve: boolean;
	/** Why right Save / Discard / Resume are disabled ('' when they are not) */
	rightResolveReason: string;
	/** Flip and Cancel (also Escape and backdrop as a Cancel) */
	flipAndCancel: boolean;
};

export const FINISH_FIRST_PART_REASON = 'Finish the first part to continue';

export function splitActionsFor(phase: SplitPhase, rightIsLive: boolean): SplitActions {
	const busy = phase === 'left-saving' || phase === 'right-busy';
	const leftUnresolved = phase === 'editing' || phase === 'left-saving';
	return {
		leftResolve: phase === 'editing',
		rightStop: rightIsLive && !busy && phase !== 'closed',
		rightResolve: phase === 'resolved',
		rightResolveReason: leftUnresolved ? FINISH_FIRST_PART_REASON : '',
		flipAndCancel: phase === 'editing'
	};
}

/**
 * SP-07, crossing into the small layout:
 * - left unresolved → `cancel` (as Cancel: elapsed time or an explicit Stop is kept);
 * - left resolved → `return-remainder` (keep the result; the right part and its fields go back to
 *   ordinary capture or completion, running or stopped as it is: never Resume);
 * - a request in flight → `wait`, then decide again from the phase it settles into;
 * - closed → nothing (growing again never reopens).
 */
export function resizeDecisionFor(phase: SplitPhase): 'cancel' | 'return-remainder' | 'wait' | 'nothing' {
	if (phase === 'editing') return 'cancel';
	if (phase === 'resolved') return 'return-remainder';
	if (phase === 'left-saving' || phase === 'right-busy') return 'wait';
	return 'nothing';
}
