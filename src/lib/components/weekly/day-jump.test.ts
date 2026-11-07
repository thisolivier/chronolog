import { describe, it, expect } from 'vitest';
import { dayJumpScrollTop } from './day-jump';

describe('dayJumpScrollTop', () => {
	it('puts the day at the top of the scroller, below anything pinned there', () => {
		expect(dayJumpScrollTop({ dayTop: 900, scrollerTop: 150, scrollTop: 200, stickyInsetPixels: 0 })).toBe(950);
		expect(dayJumpScrollTop({ dayTop: 900, scrollerTop: 150, scrollTop: 200, stickyInsetPixels: 36 })).toBe(914);
	});

	it('never scrolls above the top', () => {
		expect(dayJumpScrollTop({ dayTop: 160, scrollerTop: 150, scrollTop: 0, stickyInsetPixels: 36 })).toBe(0);
	});
});
