/**
 * Split time entry points (design r1 TC-07 / SP-01, sprint 056-DR UI): the Split buttons beside
 * Add note (running) and in the stopped form's header open the two-card overlay for the capture.
 *
 * Only a server draft can be split: `POST /api/timer/split` works on the draft row, and a timer
 * started with no contract lives only in this browser (pending-timer.ts). Such a timer gets a
 * disabled Split with the reason ("Choose a contract to split this time") instead of a second,
 * browser-only split path. Phone layouts never show Split; offline disables it (SplitTimeButton).
 */
export type SplitEntry = {
	/** Opens the overlay; undefined when Split is disabled */
	onSplit: (() => void) | undefined;
	/** Why Split is disabled ('' when it is not) */
	disabledReason: string;
};

export const NO_CONTRACT_SPLIT_REASON = 'Choose a contract to split this time';

export function splitEntryFor(capture: { hasServerDraft: boolean; isSplitOpen: boolean }, open: () => void): SplitEntry {
	if (!capture.hasServerDraft) return { onSplit: undefined, disabledReason: NO_CONTRACT_SPLIT_REASON };
	if (capture.isSplitOpen) return { onSplit: undefined, disabledReason: 'Split time is open' };
	return { onSplit: open, disabledReason: '' };
}
