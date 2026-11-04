// @vitest-environment jsdom
/**
 * Sprint 042-CL, find in page: the editor plugin highlights with decorations and never changes the
 * document (no `update` event, so no autosave) and matches across marks; the DOM finder ignores
 * the find bar, inputs and hidden text; the shortcuts follow the platform.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
	CURRENT_MATCH_CLASS,
	MATCH_CLASS,
	editorFindKey,
	findMatchesInDocument,
	getEditorFindState,
	removeFindPlugin,
	updateEditorFind
} from './editor-find';
import { findRangesIn } from './dom-find';
import { isFindShortcut, isSearchShortcut } from './shortcuts';

let editor: Editor;

beforeEach(() => {
	const element = document.createElement('div');
	document.body.appendChild(element);
	editor = new Editor({
		element,
		extensions: [StarterKit],
		content: '<h1>Budget plan</h1><p>The <strong>bud</strong>get and the BUDGET.</p><p>Next budget</p>'
	});
});

afterEach(() => {
	editor.destroy();
	document.body.innerHTML = '';
});

describe('editor find', () => {
	it('finds matches across marks, case-insensitively, in document order', () => {
		const matches = findMatchesInDocument(editor.state.doc, 'budget');
		expect(matches).toHaveLength(4);
		expect(matches.map((match) => editor.state.doc.textBetween(match.from, match.to))).toEqual([
			'Budget',
			'budget',
			'BUDGET',
			'budget'
		]);
	});

	it('decorates every match and the current one, without changing the document', () => {
		const onUpdate = vi.fn();
		editor.on('update', onUpdate);
		const documentBefore = editor.state.doc;

		const state = updateEditorFind(editor, { query: 'budget', currentIndex: 0 });
		expect(state.matches).toHaveLength(4);
		expect(state.currentIndex).toBe(0);
		expect(editor.view.dom.querySelectorAll(`.${MATCH_CLASS}`).length).toBeGreaterThanOrEqual(4);
		expect(editor.view.dom.querySelectorAll(`.${CURRENT_MATCH_CLASS}`)).toHaveLength(1);

		updateEditorFind(editor, { currentIndex: 3 });
		expect(getEditorFindState(editor).currentIndex).toBe(3);
		expect(editor.view.dom.querySelector(`.${CURRENT_MATCH_CLASS}`)?.textContent).toBe('budget');

		expect(editor.state.doc).toBe(documentBefore);
		expect(onUpdate).not.toHaveBeenCalled();
		expect(editor.can().undo()).toBe(false);
	});

	it('follows edits while open, clamps the current match, and goes away when removed', () => {
		updateEditorFind(editor, { query: 'next', currentIndex: 5 });
		expect(getEditorFindState(editor).currentIndex).toBe(0);
		editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' next');
		expect(getEditorFindState(editor).matches).toHaveLength(2);

		removeFindPlugin(editor);
		expect(editorFindKey.getState(editor.state)).toBeUndefined();
		expect(editor.view.dom.querySelectorAll(`.${MATCH_CLASS}`)).toHaveLength(0);
	});
});

describe('DOM find', () => {
	it('finds visible text only, skipping the find bar and inputs', () => {
		const root = document.createElement('div');
		root.innerHTML = `
			<div data-find-exclude><input value="report" /><span>report</span></div>
			<p>Wrote the report</p>
			<p class="hidden">report hidden</p>
			<textarea>report</textarea>
			<p>Report again, report</p>`;
		document.body.appendChild(root);
		// jsdom has no layout: treat everything but `.hidden` as rendered
		const original = Element.prototype.getClientRects;
		Element.prototype.getClientRects = function (this: Element) {
			return (this.classList.contains('hidden') ? [] : [{}]) as unknown as DOMRectList;
		};
		try {
			const ranges = findRangesIn(root, 'report');
			expect(ranges.map((range) => range.toString())).toEqual(['report', 'Report', 'report']);
		} finally {
			Element.prototype.getClientRects = original;
		}
	});
});

describe('shortcuts', () => {
	const key = (letter: string, modifiers: Partial<KeyboardEvent> = {}) =>
		({ key: letter, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers }) as KeyboardEvent;

	it('uses Cmd on Apple platforms and Ctrl elsewhere', () => {
		expect(isFindShortcut(key('f', { metaKey: true }), true)).toBe(true);
		expect(isFindShortcut(key('f', { ctrlKey: true }), true)).toBe(false);
		expect(isFindShortcut(key('f', { ctrlKey: true }), false)).toBe(true);
		expect(isFindShortcut(key('F', { metaKey: true, shiftKey: true }), true)).toBe(false);
		expect(isSearchShortcut(key('k', { metaKey: true }), true)).toBe(true);
		expect(isSearchShortcut(key('k', { ctrlKey: true }), false)).toBe(true);
		expect(isSearchShortcut(key('k'), false)).toBe(false);
	});
});
