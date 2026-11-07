/**
 * The ontology cascade rules (design r1 TC-05 / IN-03, sprint 055-DR): contract → deliverable →
 * work type. Pure functions; the reactive controller is `ontology-cascade.svelte.ts`.
 *
 * Each level is in one of five states, always drawn in the same place (no control pops in):
 * - `waiting`        the parent is not chosen ("Choose a contract first")
 * - `loading`        the options for the chosen parent are on their way
 * - `ready`          options exist and can be browsed
 * - `not-applicable` the parent is chosen and has no options ("Not applicable")
 * - `failed`         the options could not be loaded; the held value is kept, Retry is offered
 */

export interface CascadeOption {
	id: string;
	name: string;
}

export type CascadeLevelStatus = 'waiting' | 'loading' | 'ready' | 'not-applicable' | 'failed';

export interface CascadeLevelState {
	status: CascadeLevelStatus;
	options: CascadeOption[];
}

export type CascadeLevelName = 'contract' | 'deliverable' | 'workType';

export function waitingLevel(): CascadeLevelState {
	return { status: 'waiting', options: [] };
}

/** A successful load: options to browse, or "not applicable" when the parent has none */
export function loadedLevel(options: CascadeOption[]): CascadeLevelState {
	return { status: options.length > 0 ? 'ready' : 'not-applicable', options };
}

/**
 * The selection a level holds after its options load (or fail to):
 * - waiting / not applicable: nothing can be chosen, so the value clears;
 * - loading / failed: the options are unknown, so the held value is kept (never guessed away);
 * - ready: a still-valid value is kept; otherwise exactly one option is chosen for the user
 *   (the sole-option rule, which then continues down the chain); otherwise nothing.
 */
export function resolveSelection(currentId: string, level: CascadeLevelState): string {
	switch (level.status) {
		case 'waiting':
		case 'not-applicable':
			return '';
		case 'loading':
		case 'failed':
			return currentId;
		case 'ready':
			if (currentId && level.options.some((option) => option.id === currentId)) return currentId;
			return level.options.length === 1 ? level.options[0].id : '';
	}
}

/**
 * The root level (contract) has no parent to invalidate it: a held contract is kept even when
 * the list does not offer it (an archived contract on a restored capture; the server validates
 * on save). An empty root takes the sole option.
 */
export function resolveRootSelection(currentId: string, level: CascadeLevelState): string {
	if (currentId) return currentId;
	return level.status === 'ready' && level.options.length === 1 ? level.options[0].id : '';
}

const PLURAL: Record<CascadeLevelName, string> = {
	contract: 'contracts',
	deliverable: 'deliverables',
	workType: 'work types'
};

const PARENT: Record<CascadeLevelName, string> = {
	contract: '',
	deliverable: 'contract',
	workType: 'deliverable'
};

/** The text a disabled level shows in place of its options; '' when the level can be browsed */
export function levelPlaceholder(level: CascadeLevelName, state: CascadeLevelState, hasHeldValue: boolean): string {
	switch (state.status) {
		case 'waiting':
			return `Choose a ${PARENT[level]} first`;
		case 'loading':
			return 'Loading…';
		case 'not-applicable':
			return level === 'contract' ? 'No contracts yet' : 'Not applicable';
		case 'failed':
			return hasHeldValue ? `Couldn't load ${PLURAL[level]}: your choice is kept` : `Couldn't load ${PLURAL[level]}`;
		case 'ready':
			return '';
	}
}

/** The "none" option of a browsable level (a deliverable and a work type are optional) */
export function noneOptionLabel(level: CascadeLevelName): string {
	return level === 'contract' ? 'Select a contract…' : level === 'deliverable' ? 'No deliverable' : 'No work type';
}
