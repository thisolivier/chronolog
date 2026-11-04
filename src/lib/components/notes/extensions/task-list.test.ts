// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { Editor, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { Markdown } from 'tiptap-markdown';
import { WikiLink } from './wiki-link';
import { MarkdownText } from './markdown-text';
import { AnchoredHeading } from './anchored-heading';
import { TaskListExtensions } from './task-list';

/** The note editor's markdown-relevant extensions, as registered in NoteEditor.svelte. */
function createTestEditor(content: string | JSONContent = '') {
	return new Editor({
		extensions: [
			StarterKit.configure({ heading: false, codeBlock: false, text: false, link: false }),
			MarkdownText,
			CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
			AnchoredHeading,
			Markdown,
			WikiLink,
			...TaskListExtensions
		],
		content
	});
}

function getMarkdown(editor: Editor): string {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (editor.storage as any).markdown.getMarkdown();
}

/** Node types only, as a compact outline: `taskList(taskItem+(paragraph))`. */
function outline(node: JSONContent): string {
	if (node.type === 'text') return '';
	const checked = node.type === 'taskItem' ? (node.attrs?.checked ? '+' : '-') : '';
	const children = (node.content ?? []).map(outline).filter(Boolean).join(',');
	return `${node.type}${checked}${children ? `(${children})` : ''}`;
}

function roundTrip(markdown: string): string {
	const first = getMarkdown(createTestEditor(markdown));
	// a second pass must be stable: what is saved reads back the same
	expect(getMarkdown(createTestEditor(first))).toBe(first);
	return first;
}

/** Type `text` at the caret through the input-rule path, as a keystroke would. */
function typeText(editor: Editor, text: string) {
	for (const character of text) {
		const { from, to } = editor.state.selection;
		const handled = editor.view.someProp('handleTextInput', (handler) => handler(editor.view, from, to, character, () => editor.state.tr.insertText(character, from, to)));
		if (!handled) editor.view.dispatch(editor.state.tr.insertText(character, from, to));
	}
}

describe('task list markdown round-trip', () => {
	it('reads `- [ ]` and `- [x]` as task items and writes them back one per line', () => {
		const markdown = '- [ ] open item\n- [x] done item';
		const editor = createTestEditor(markdown);
		expect(outline(editor.getJSON())).toBe('doc(taskList(taskItem-(paragraph),taskItem+(paragraph)))');
		expect(roundTrip(markdown)).toBe(markdown);
	});

	it('keeps nested task items', () => {
		const markdown = '- [ ] parent\n  - [x] child done\n  - [ ] child open\n    - [ ] grandchild\n- [x] second';
		const editor = createTestEditor(markdown);
		expect(outline(editor.getJSON())).toBe(
			'doc(taskList(taskItem-(paragraph,taskList(taskItem+(paragraph),taskItem-(paragraph,taskList(taskItem-(paragraph))))),taskItem+(paragraph)))'
		);
		expect(roundTrip(markdown)).toBe(markdown);
	});

	it('keeps a task list beside bullet lists apart (marker switches to *)', () => {
		const markdown = '- bullet before\n\n* [ ] task\n* [x] done\n\n- bullet after';
		const editor = createTestEditor(markdown);
		expect(outline(editor.getJSON())).toBe(
			'doc(bulletList(listItem(paragraph)),taskList(taskItem-(paragraph),taskItem+(paragraph)),bulletList(listItem(paragraph)))'
		);
		expect(roundTrip(markdown)).toBe(markdown);
	});

	it('splits a mixed list written by hand (or by the CLI) into bullets and tasks', () => {
		const editor = createTestEditor('- plain\n- [ ] task one\n- [x] task two\n- plain again\n');
		expect(outline(editor.getJSON())).toBe(
			'doc(bulletList(listItem(paragraph)),taskList(taskItem-(paragraph),taskItem+(paragraph)),bulletList(listItem(paragraph)))'
		);
		const markdown = getMarkdown(editor);
		expect(markdown).toContain('* [ ] task one\n* [x] task two');
		expect(roundTrip(markdown)).toBe(markdown);
	});

	it('nests a task list under a bullet item', () => {
		const markdown = '- topic\n  - [ ] follow up\n  - [x] sent';
		expect(outline(createTestEditor(markdown).getJSON())).toBe(
			'doc(bulletList(listItem(paragraph,taskList(taskItem-(paragraph),taskItem+(paragraph)))))'
		);
		expect(roundTrip(markdown)).toBe(markdown);
	});

	it('round-trips inside a note with headings, wiki-links and code blocks', () => {
		const markdown = [
			'# Weekly sync',
			'',
			'See [[ACME.20261104.001]] for context.',
			'',
			'- [ ] Call [[ACME.20261104.002|Jane]] about **budget**',
			'- [x] Send `report.pdf`',
			'',
			'```js',
			'- [ ] not a task in code',
			'```',
			'',
			'1. numbered',
			'2. list'
		].join('\n');
		const editor = createTestEditor(markdown);
		expect(outline(editor.getJSON())).toBe(
			'doc(heading,paragraph(wikiLink),taskList(taskItem-(paragraph(wikiLink)),taskItem+(paragraph)),codeBlock,orderedList(listItem(paragraph),listItem(paragraph)))'
		);
		expect(roundTrip(markdown)).toBe(markdown);
	});

	it('reads uppercase [X] as done', () => {
		const editor = createTestEditor('- [X] shouted');
		const firstItem = editor.getJSON().content?.[0].content?.[0] as JSONContent;
		expect(firstItem.attrs?.checked).toBe(true);
	});

	it('serialises task lists stored as JSON by an older editor (no tight attribute)', () => {
		const json: JSONContent = {
			type: 'doc',
			content: [{ type: 'taskList', content: [
				{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }] },
				{ type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }] }
			] }]
		};
		expect(getMarkdown(createTestEditor(json))).toBe('- [ ] a\n- [x] b');
	});
});

describe('typing task markers', () => {
	it('`[ ] ` at the start of a bullet item turns that item into a task item', () => {
		const editor = createTestEditor('- first\n- \n- third');
		// caret into the empty second item
		let secondItemParagraph = 0;
		editor.state.doc.descendants((node, position) => {
			if (node.type.name === 'paragraph' && node.content.size === 0) secondItemParagraph = position + 1;
		});
		editor.commands.setTextSelection(secondItemParagraph);
		typeText(editor, '[ ] call Jane');
		expect(outline(editor.getJSON())).toBe(
			// StarterKit's TrailingNode keeps an empty paragraph after a final list once edited
			'doc(bulletList(listItem(paragraph)),taskList(taskItem-(paragraph)),bulletList(listItem(paragraph)),paragraph)'
		);
		expect(getMarkdown(editor)).toBe('- first\n\n* [ ] call Jane\n\n- third');
	});

	it('`[x] ` makes a done item and joins the task list above', () => {
		const editor = createTestEditor('- [ ] one\n\n- ');
		const end = editor.state.doc.content.size - 3;
		editor.commands.setTextSelection(end);
		typeText(editor, '[x] two');
		expect(outline(editor.getJSON())).toBe('doc(taskList(taskItem-(paragraph),taskItem+(paragraph)),paragraph)');
		expect(getMarkdown(editor)).toBe('- [ ] one\n- [x] two');
	});

	it('`[] ` in a plain paragraph starts a task list (stock rule)', () => {
		const editor = createTestEditor('');
		editor.commands.setTextSelection(1);
		typeText(editor, '[] plain start');
		expect(getMarkdown(editor)).toBe('- [ ] plain start');
	});

	it('the toolbar command toggles a task list on and off', () => {
		const editor = createTestEditor('an item');
		editor.commands.setTextSelection(2);
		editor.commands.toggleTaskList();
		expect(getMarkdown(editor)).toBe('- [ ] an item');
		editor.commands.toggleTaskList();
		expect(getMarkdown(editor)).toBe('an item');
	});
});
