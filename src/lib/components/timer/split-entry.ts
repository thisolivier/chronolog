/**
 * Split time entry (design r1 SP-01, stage 5). STAGE 5 STUB (sprint 055-DR): the buttons exist
 * (SplitTimeButton, beside Add note while running and in the stopped form's header) but the
 * two-card split overlay is not built yet, so there is no handler and the buttons stay disabled.
 * Stage 5 replaces `splitHandlerFor` with one that opens the overlay for the current capture.
 */
export function splitHandlerFor(): (() => void) | undefined {
	// TODO(stage 5, sprint 057-DR or later): open the split overlay (docs/sprints/sprint-055-DR.md)
	return undefined;
}
