import { describe, expect, it } from 'vitest';
import { placeLinkPicker } from './link-picker-placement';

const desktop = { top: 0, left: 0, width: 1280, height: 800 };

describe('placeLinkPicker on desktop', () => {
	it('anchors under the query with the list height', () => {
		const placement = placeLinkPicker({ anchor: { top: 200, bottom: 220, left: 300 }, viewport: desktop, contentHeight: 240, isPhone: false });
		expect(placement).toEqual({ top: 224, left: 300, width: 460, maxHeight: 320, side: 'below' });
	});

	it('flips above near the bottom edge and keeps the list on screen sideways', () => {
		const placement = placeLinkPicker({ anchor: { top: 700, bottom: 720, left: 1200 }, viewport: desktop, contentHeight: 240, isPhone: false });
		expect(placement.side).toBe('above');
		expect(placement.top).toBe(700 - 4 - 240);
		expect(placement.left).toBe(1280 - 8 - 460);
	});

	it('scrolls inside the room it has when neither side holds the whole list', () => {
		const short = { top: 0, left: 0, width: 600, height: 300 };
		const placement = placeLinkPicker({ anchor: { top: 160, bottom: 180, left: 10 }, viewport: short, contentHeight: 400, isPhone: false });
		expect(placement.side).toBe('above');
		expect(placement.maxHeight).toBe(160 - 4 - 8);
		expect(placement.top).toBe(8);
	});
});

describe('placeLinkPicker on a phone', () => {
	it('sits above the software keyboard, over the query, when the room under the query is cramped', () => {
		// 390 x 844 screen, keyboard leaves 400 px of visual viewport; query near its bottom
		const placement = placeLinkPicker({
			anchor: { top: 340, bottom: 362, left: 200 },
			viewport: { top: 0, left: 0, width: 390, height: 400 },
			contentHeight: 300,
			isPhone: true
		});
		expect(placement.side).toBe('above');
		expect(placement.left).toBe(8);
		expect(placement.width).toBe(374);
		expect(placement.top + Math.min(300, placement.maxHeight)).toBeLessThanOrEqual(340);
		expect(placement.top).toBeGreaterThanOrEqual(8);
	});

	it('goes under the query and ends above the keyboard when there is room', () => {
		const placement = placeLinkPicker({
			anchor: { top: 100, bottom: 122, left: 40 },
			viewport: { top: 0, left: 0, width: 390, height: 420 },
			contentHeight: 500,
			isPhone: true
		});
		expect(placement.side).toBe('below');
		expect(placement.top).toBe(126);
		expect(placement.top + placement.maxHeight).toBeLessThanOrEqual(420 - 8);
	});

	it('follows a scrolled visual viewport and a query hidden under the keyboard', () => {
		const placement = placeLinkPicker({
			anchor: { top: 900, bottom: 922, left: 40 },
			viewport: { top: 300, left: 0, width: 390, height: 400 },
			contentHeight: 200,
			isPhone: true
		});
		expect(placement.side).toBe('above');
		expect(placement.top).toBeGreaterThanOrEqual(308);
		expect(placement.top + 200).toBeLessThanOrEqual(700);
	});

	it('uses the whole screen without a keyboard', () => {
		const placement = placeLinkPicker({
			anchor: { top: 200, bottom: 222, left: 40 },
			viewport: { top: 0, left: 0, width: 390, height: 844 },
			contentHeight: 600,
			isPhone: true
		});
		expect(placement).toMatchObject({ side: 'below', top: 226, maxHeight: 360 });
	});
});
