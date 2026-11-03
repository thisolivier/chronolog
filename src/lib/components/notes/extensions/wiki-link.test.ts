// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { Editor, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { WikiLink, formatWikiLinkText, parseWikiLinkText } from './wiki-link';

function createTestEditor(content: string | JSONContent = '') {
	return new Editor({
		extensions: [StarterKit.configure({ link: false }), Markdown, WikiLink],
		content,
	});
}

function getMarkdown(editor: Editor): string {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (editor.storage as any).markdown.getMarkdown();
}

function findWikiLinkNodes(json: JSONContent): JSONContent[] {
	const found: JSONContent[] = [];
	const walk = (node: JSONContent) => {
		if (node.type === 'wikiLink') found.push(node);
		node.content?.forEach(walk);
	};
	walk(json);
	return found;
}

function docWithWikiLink(attrs: Record<string, string | null>): JSONContent {
	return {
		type: 'doc',
		content: [
			{
				type: 'paragraph',
				content: [
					{ type: 'text', text: 'Before ' },
					{ type: 'wikiLink', attrs },
					{ type: 'text', text: ' after' },
				],
			},
		],
	};
}

describe('formatWikiLinkText / parseWikiLinkText', () => {
	it('round-trips every supported form', () => {
		const forms = ['NOTE.1', 'NOTE.1|Label', 'NOTE.1#heading', 'NOTE.1#heading|Label'];
		for (const form of forms) {
			const parsed = parseWikiLinkText(form);
			expect(formatWikiLinkText(parsed.noteId, parsed.headingAnchor, parsed.label)).toBe(
				`[[${form}]]`
			);
		}
	});

	it('omits the label when it equals the note id', () => {
		expect(formatWikiLinkText('NOTE.1', null, 'NOTE.1')).toBe('[[NOTE.1]]');
	});
});

describe('WikiLink markdown serializer', () => {
	it('serializes a plain wikiLink node as [[ID]] without any HTML span', () => {
		const editor = createTestEditor(
			docWithWikiLink({ noteId: 'INTL.20261103.002', label: 'INTL.20261103.002', headingAnchor: null })
		);

		const markdown = getMarkdown(editor);
		expect(markdown).toBe('Before [[INTL.20261103.002]] after');
		expect(markdown).not.toContain('<span');

		editor.destroy();
	});

	it('serializes a labelled wikiLink node as [[ID|label]]', () => {
		const editor = createTestEditor(
			docWithWikiLink({ noteId: 'INTL.20261103.002', label: 'Kickoff notes', headingAnchor: null })
		);

		expect(getMarkdown(editor)).toBe('Before [[INTL.20261103.002|Kickoff notes]] after');

		editor.destroy();
	});

	it('serializes a heading-anchored, labelled wikiLink node as [[ID#heading|label]]', () => {
		const editor = createTestEditor(
			docWithWikiLink({ noteId: 'INTL.20261103.002', label: 'Risks', headingAnchor: 'risks' })
		);

		expect(getMarkdown(editor)).toBe('Before [[INTL.20261103.002#risks|Risks]] after');

		editor.destroy();
	});

	it('serializes a heading-anchored wikiLink without a label as [[ID#heading]]', () => {
		const editor = createTestEditor(
			docWithWikiLink({ noteId: 'INTL.20261103.002', label: null, headingAnchor: 'risks' })
		);

		expect(getMarkdown(editor)).toBe('Before [[INTL.20261103.002#risks]] after');

		editor.destroy();
	});
});

describe('WikiLink markdown parse rule', () => {
	it('turns [[ID]] in markdown set via setContent into a wikiLink node', () => {
		const editor = createTestEditor('');
		editor.commands.setContent('Hello [[INTL.20261103.002]] world');

		const wikiLinks = findWikiLinkNodes(editor.getJSON());
		expect(wikiLinks).toHaveLength(1);
		expect(wikiLinks[0].attrs?.noteId).toBe('INTL.20261103.002');
		expect(wikiLinks[0].attrs?.label).toBe('INTL.20261103.002');
		expect(wikiLinks[0].attrs?.headingAnchor).toBeNull();
		expect(editor.getText()).toBe('Hello [[INTL.20261103.002]] world');

		editor.destroy();
	});

	it('parses label and heading anchor from initial markdown content', () => {
		const editor = createTestEditor('See [[INTL.20261103.002#risks|Risk register]] today');

		const wikiLinks = findWikiLinkNodes(editor.getJSON());
		expect(wikiLinks).toHaveLength(1);
		expect(wikiLinks[0].attrs).toMatchObject({
			noteId: 'INTL.20261103.002',
			label: 'Risk register',
			headingAnchor: 'risks',
		});

		editor.destroy();
	});

	it('parses several wiki-links in one paragraph and leaves normal links alone', () => {
		const editor = createTestEditor('[[A.1]] and [[B.2|Bee]] and [x](http://example.com)');

		const wikiLinks = findWikiLinkNodes(editor.getJSON());
		expect(wikiLinks.map((node) => node.attrs?.noteId)).toEqual(['A.1', 'B.2']);

		editor.destroy();
	});

	it('does not treat an unclosed [[ as a wiki-link', () => {
		const editor = createTestEditor('Typing [[ not closed');

		expect(findWikiLinkNodes(editor.getJSON())).toHaveLength(0);
		expect(editor.getText()).toBe('Typing [[ not closed');

		editor.destroy();
	});
});

describe('WikiLink markdown round-trip', () => {
	it('is stable for markdown -> json -> markdown', () => {
		const originalMarkdown =
			'# Title\n\nPlain [[INTL.20261103.002]] and [[INTL.20261103.003|Labelled]] and [[INTL.20261103.004#section|Deep]].';

		const firstEditor = createTestEditor(originalMarkdown);
		const firstMarkdown = getMarkdown(firstEditor);
		const json = firstEditor.getJSON();

		expect(firstMarkdown).toBe(originalMarkdown);
		expect(findWikiLinkNodes(json)).toHaveLength(3);

		const secondEditor = createTestEditor('');
		secondEditor.commands.setContent(json);
		expect(getMarkdown(secondEditor)).toBe(originalMarkdown);

		// Raw-mode toggle path: markdown back into the editor again
		const thirdEditor = createTestEditor('');
		thirdEditor.commands.setContent(firstMarkdown);
		expect(getMarkdown(thirdEditor)).toBe(originalMarkdown);
		expect(findWikiLinkNodes(thirdEditor.getJSON())).toHaveLength(3);

		firstEditor.destroy();
		secondEditor.destroy();
		thirdEditor.destroy();
	});
});
