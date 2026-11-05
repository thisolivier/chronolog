// @vitest-environment jsdom
/**
 * Sprint 050-UI: Back / Forward shortcuts (Cmd+[ / Cmd+] on Apple, Ctrl elsewhere; Alt+Left /
 * Alt+Right) and never while typing in a field or the editor.
 */
import { describe, it, expect } from 'vitest';
import { historyShortcutDirection, isTypingTarget } from './history-shortcuts';

type Keys = { key: string; code?: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; target?: EventTarget | null };

const press = ({ key, code = '', metaKey = false, ctrlKey = false, altKey = false, shiftKey = false, target = document.body }: Keys) => ({
	key,
	code,
	metaKey,
	ctrlKey,
	altKey,
	shiftKey,
	target
});

describe('historyShortcutDirection', () => {
	it('Cmd+[ and Cmd+] on Apple platforms', () => {
		expect(historyShortcutDirection(press({ key: '[', metaKey: true }), true)).toBe('back');
		expect(historyShortcutDirection(press({ key: ']', metaKey: true }), true)).toBe('forward');
		expect(historyShortcutDirection(press({ key: '[', ctrlKey: true }), true)).toBeNull();
	});

	it('Ctrl+[ and Ctrl+] elsewhere, also by key position', () => {
		expect(historyShortcutDirection(press({ key: '[', ctrlKey: true }), false)).toBe('back');
		expect(historyShortcutDirection(press({ key: 'ü', code: 'BracketRight', ctrlKey: true }), false)).toBe('forward');
		expect(historyShortcutDirection(press({ key: '[', metaKey: true }), false)).toBeNull();
	});

	it('Alt+Left and Alt+Right everywhere', () => {
		for (const apple of [true, false]) {
			expect(historyShortcutDirection(press({ key: 'ArrowLeft', altKey: true }), apple)).toBe('back');
			expect(historyShortcutDirection(press({ key: 'ArrowRight', altKey: true }), apple)).toBe('forward');
		}
		expect(historyShortcutDirection(press({ key: 'ArrowLeft' }), true)).toBeNull();
		expect(historyShortcutDirection(press({ key: 'ArrowLeft', altKey: true, shiftKey: true }), true)).toBeNull();
	});

	it('does nothing while typing in a field or the editor', () => {
		const input = document.createElement('input');
		const editable = document.createElement('div');
		editable.setAttribute('contenteditable', 'true');
		const paragraph = document.createElement('p');
		editable.appendChild(paragraph);
		document.body.append(input, editable);
		expect(isTypingTarget(input)).toBe(true);
		expect(isTypingTarget(paragraph)).toBe(true);
		expect(isTypingTarget(document.body)).toBe(false);
		expect(historyShortcutDirection(press({ key: '[', metaKey: true, target: input }), true)).toBeNull();
		expect(historyShortcutDirection(press({ key: 'ArrowLeft', altKey: true, target: paragraph }), true)).toBeNull();
	});
});
