import { describe, expect, it } from 'vitest';
import { decideSheetRelease, releaseVelocity, sheetOffset, shouldTakeOver } from './sheet-drag';

describe('decideSheetRelease', () => {
	it('closes past 96 px', () => {
		expect(decideSheetRelease({ distance: 150, velocity: 0 })).toBe('dismiss');
		expect(decideSheetRelease({ distance: 97, velocity: 0 })).toBe('dismiss');
	});
	it('closes on a clear downward flick, even a short one', () => {
		expect(decideSheetRelease({ distance: 30, velocity: 0.8 })).toBe('dismiss');
	});
	it('springs back for a short slow drag, an upward flick or no drag', () => {
		expect(decideSheetRelease({ distance: 40, velocity: 0.1 })).toBe('restore');
		expect(decideSheetRelease({ distance: 60, velocity: -1 })).toBe('restore');
		expect(decideSheetRelease({ distance: 0, velocity: 2 })).toBe('restore');
	});
});

describe('shouldTakeOver', () => {
	it('takes a downward pull on the list only when the list is at its top', () => {
		expect(shouldTakeOver({ startedOnList: true, listAtTop: true, deltaY: 10 })).toBe(true);
		expect(shouldTakeOver({ startedOnList: true, listAtTop: false, deltaY: 10 })).toBe(false);
	});
	it('leaves an upward move to the list', () => {
		expect(shouldTakeOver({ startedOnList: true, listAtTop: true, deltaY: -10 })).toBe(false);
	});
	it('takes a downward drag on the handle, header or footer wherever the list is', () => {
		expect(shouldTakeOver({ startedOnList: false, listAtTop: false, deltaY: 10 })).toBe(true);
		expect(shouldTakeOver({ startedOnList: false, listAtTop: true, deltaY: -10 })).toBe(false);
	});
});

describe('sheetOffset', () => {
	it('follows the finger down, never up, softer past half the sheet', () => {
		expect(sheetOffset(-30, 600)).toBe(0);
		expect(sheetOffset(120, 600)).toBe(120);
		expect(sheetOffset(400, 600)).toBe(350);
	});
});

describe('releaseVelocity', () => {
	it('measures the last 100 ms only', () => {
		const samples = [
			{ time: 0, y: 0 },
			{ time: 300, y: 40 },
			{ time: 350, y: 40 },
			{ time: 400, y: 40 }
		];
		expect(releaseVelocity(samples)).toBe(0);
		expect(releaseVelocity([{ time: 0, y: 0 }, { time: 50, y: 50 }])).toBe(1);
		expect(releaseVelocity([])).toBe(0);
	});
});
