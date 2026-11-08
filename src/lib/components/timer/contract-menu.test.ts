import { describe, expect, it } from 'vitest';
import { MENU_EDGE_MARGIN, MENU_TRIGGER_GAP, nextMenuItemIndex, placeContractMenu } from './contract-menu';

describe('nextMenuItemIndex', () => {
	it('moves down and up, wrapping at the ends', () => {
		expect(nextMenuItemIndex('ArrowDown', 0, 3)).toBe(1);
		expect(nextMenuItemIndex('ArrowDown', 2, 3)).toBe(0);
		expect(nextMenuItemIndex('ArrowUp', 0, 3)).toBe(2);
		expect(nextMenuItemIndex('ArrowUp', 2, 3)).toBe(1);
	});

	it('starts at the first or last item when no item has focus', () => {
		expect(nextMenuItemIndex('ArrowDown', -1, 3)).toBe(0);
		expect(nextMenuItemIndex('ArrowUp', -1, 3)).toBe(2);
	});

	it('jumps with Home and End', () => {
		expect(nextMenuItemIndex('Home', 2, 4)).toBe(0);
		expect(nextMenuItemIndex('End', 0, 4)).toBe(3);
	});

	it('ignores other keys and empty menus', () => {
		expect(nextMenuItemIndex('Enter', 1, 3)).toBeNull();
		expect(nextMenuItemIndex('a', 1, 3)).toBeNull();
		expect(nextMenuItemIndex('ArrowDown', -1, 0)).toBeNull();
	});
});

describe('placeContractMenu', () => {
	const viewport = { width: 1280, height: 800 };

	it('opens under the trigger at its left edge when there is room', () => {
		const placement = placeContractMenu({ left: 60, top: 500, bottom: 516 }, viewport, 280, 200);
		expect(placement).toEqual({ left: 60, width: 280, top: 516 + MENU_TRIGGER_GAP, bottom: null, maxHeight: 800 - 516 - MENU_TRIGGER_GAP - MENU_EDGE_MARGIN });
	});

	it('drops down, scrolling, when a few rows fit below even if more would fit above', () => {
		const placement = placeContractMenu({ left: 60, top: 590, bottom: 606 }, viewport, 280, 300);
		expect(placement.top).toBe(606 + MENU_TRIGGER_GAP);
		expect(placement.maxHeight).toBe(800 - 606 - MENU_TRIGGER_GAP - MENU_EDGE_MARGIN);
	});

	it('flips above when not even a few rows fit below and there is more room above', () => {
		const placement = placeContractMenu({ left: 60, top: 700, bottom: 716 }, viewport, 280, 300);
		expect(placement.top).toBeNull();
		expect(placement.bottom).toBe(800 - 700 + MENU_TRIGGER_GAP);
		expect(placement.maxHeight).toBe(700 - MENU_TRIGGER_GAP - MENU_EDGE_MARGIN);
	});

	it('stays below, scrolling, when below still has the most room', () => {
		const placement = placeContractMenu({ left: 60, top: 300, bottom: 316 }, viewport, 280, 900);
		expect(placement.top).toBe(316 + MENU_TRIGGER_GAP);
		expect(placement.maxHeight).toBe(800 - 316 - MENU_TRIGGER_GAP - MENU_EDGE_MARGIN);
	});

	it('keeps the menu inside a narrow viewport', () => {
		const phone = { width: 375, height: 667 };
		const placement = placeContractMenu({ left: 300, top: 100, bottom: 116 }, phone, 400, 200);
		expect(placement.width).toBe(375 - 2 * MENU_EDGE_MARGIN);
		expect(placement.left).toBe(MENU_EDGE_MARGIN);
		const shifted = placeContractMenu({ left: 300, top: 100, bottom: 116 }, phone, 200, 200);
		expect(shifted.left + shifted.width).toBe(375 - MENU_EDGE_MARGIN);
	});
});
