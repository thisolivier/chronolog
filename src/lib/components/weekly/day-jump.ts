/**
 * Where to scroll the timesheet so a day's heading sits at the top (sprint 057-DR, TR-01/02).
 * The week controls live outside the scroller, so the only sticky layer inside it is the day
 * heading itself; anything else pinned at the top of the scroller (`stickyInsetPixels`, measured
 * by the caller) is subtracted so neither the heading nor the first entry is covered. Replaces the
 * old fixed 8px offset.
 */
export function dayJumpScrollTop(options: {
	dayTop: number;
	scrollerTop: number;
	scrollTop: number;
	stickyInsetPixels: number;
}): number {
	return Math.max(0, Math.round(options.dayTop - options.scrollerTop + options.scrollTop - options.stickyInsetPixels));
}
