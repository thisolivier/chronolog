// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { TaskListExtensions } from './extensions/task-list';
import { cleanEditorHtml, buildPrintDocument } from './note-print';
import { buildMarkdownExportContent } from './note-export';

const NOTE_MARKDOWN = '# Plan\n\n- [ ] open item\n- [x] done item\n  - [ ] nested open';

describe('task lists in exports (sprint 040-CL)', () => {
	it('prints each task item as a box that shows its state', () => {
		const mount = document.createElement('div');
		const editor = new Editor({ element: mount, extensions: [StarterKit, Markdown, ...TaskListExtensions], content: NOTE_MARKDOWN });
		const html = cleanEditorHtml(editor.view.dom as HTMLElement);
		const printed = document.createElement('div');
		printed.innerHTML = html;
		const boxes = Array.from(printed.querySelectorAll('.task-box')).map((box) => box.textContent);
		expect(boxes).toEqual(['☐', '☑', '☐']);
		expect(printed.querySelector('input[type="checkbox"]')).toBeNull();
		expect(printed.textContent).toContain('done item');
		expect(buildPrintDocument({ title: 'Plan', noteId: 'X.1', bodyHtml: html })).toContain('ul[data-type="taskList"] { list-style: none;');
		editor.destroy();
	});

	it('keeps the checkbox syntax in the markdown export', () => {
		expect(buildMarkdownExportContent('Plan', NOTE_MARKDOWN + '\n')).toBe(NOTE_MARKDOWN + '\n');
		expect(buildMarkdownExportContent('Other', '- [x] done')).toBe('# Other\n\n- [x] done');
	});
});
