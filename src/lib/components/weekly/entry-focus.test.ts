import { describe, expect, it, vi } from 'vitest';
import { focusSavedEntry } from './entry-focus';

function fakeRoot(elements: Record<string, { focus: () => void }>) {
	return { querySelector: (selector: string) => elements[selector] ?? null } as unknown as ParentNode;
}

describe('focusSavedEntry', () => {
	it('focuses the saved card when it is rendered', () => {
		const card = { focus: vi.fn() };
		const addEntry = { focus: vi.fn() };
		const root = fakeRoot({ '[data-entry-id="entry-1"]': card, '[data-add-entry="2026-11-03"]': addEntry });
		expect(focusSavedEntry(root, 'entry-1', '2026-11-03')).toBe('card');
		expect(card.focus).toHaveBeenCalledOnce();
		expect(addEntry.focus).not.toHaveBeenCalled();
	});

	it("falls back to the day's add-entry control when the card is not rendered", () => {
		const addEntry = { focus: vi.fn() };
		const root = fakeRoot({ '[data-add-entry="2026-11-03"]': addEntry });
		expect(focusSavedEntry(root, 'missing', '2026-11-03')).toBe('add-entry');
		expect(focusSavedEntry(root, undefined, '2026-11-03')).toBe('add-entry');
		expect(addEntry.focus).toHaveBeenCalledTimes(2);
	});

	it('does nothing when neither is on screen', () => {
		expect(focusSavedEntry(fakeRoot({}), 'entry-1', '2026-11-03')).toBeNull();
	});

	it('escapes quotes in ids', () => {
		const card = { focus: vi.fn() };
		const root = fakeRoot({ '[data-entry-id="a\\"b"]': card });
		expect(focusSavedEntry(root, 'a"b', '2026-11-03')).toBe('card');
	});
});
