// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { MarkdownText, escapeTagOpeners } from './markdown-text';

let editor: Editor | null = null;

function createEditor(content: string) {
	editor = new Editor({
		extensions: [StarterKit.configure({ text: false }), MarkdownText, Markdown],
		content
	});
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (editor.storage as any).markdown.getMarkdown() as string;
}

afterEach(() => {
	editor?.destroy();
	editor = null;
});

describe('escapeTagOpeners', () => {
	it('escapes only a < that could open a tag', () => {
		expect(escapeTagOpeners('a -> b & c < 3')).toBe('a -> b & c < 3');
		expect(escapeTagOpeners('<b>bold</b>')).toBe('&lt;b>bold&lt;/b>');
	});
});

describe('MarkdownText serializer', () => {
	it('keeps arrows readable in markdown (no &gt;)', () => {
		const markdown = createEditor('<p>L1 -&gt; on-call -&gt; Olivier.</p>');
		expect(markdown).toBe('L1 -> on-call -> Olivier.');
	});

	it('round-trips older content that was saved with entities', () => {
		const markdown = createEditor('L1 -&gt; on-call');
		expect(markdown).toBe('L1 -> on-call');
	});

	it('keeps literal tag-like text from turning into HTML', () => {
		const markdown = createEditor('<p>type &lt;div&gt; here</p>');
		expect(markdown).toBe('type &lt;div> here');
	});

	it('still renders lists as markdown', () => {
		const markdown = createEditor('<ul><li><p>one</p></li><li><p>two</p></li></ul><ol><li><p>first</p></li></ol>');
		expect(markdown).toMatch(/^- one\n+- two\n+1\. first$/);
	});
});
