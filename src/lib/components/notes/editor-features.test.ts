// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { Markdown } from 'tiptap-markdown';

const lowlightInstance = createLowlight(common);

function createTestEditor(content: string = '') {
	return new Editor({
		extensions: [
			StarterKit.configure({ codeBlock: false }),
			CodeBlockLowlight.configure({ lowlight: lowlightInstance }),
			Markdown,
		],
		content,
	});
}

describe('Code block extension', () => {
	it('creates a code block node from markdown content', () => {
		const markdown = '```javascript\nconst x = 1;\n```';
		const editor = createTestEditor(markdown);

		const json = editor.getJSON();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const codeBlock = json.content?.find((node: any) => node.type === 'codeBlock');

		expect(codeBlock).toBeDefined();
		expect(codeBlock?.attrs?.language).toBe('javascript');

		editor.destroy();
	});

	it('preserves code block language through JSON round-trip', () => {
		const markdown = '```python\ndef hello():\n    pass\n```';
		const editor = createTestEditor(markdown);

		const json = editor.getJSON();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const codeBlock = json.content?.find((node: any) => node.type === 'codeBlock');
		expect(codeBlock?.attrs?.language).toBe('python');

		// Round-trip: set content from JSON
		const editor2 = createTestEditor('');
		editor2.commands.setContent(json);

		const json2 = editor2.getJSON();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const codeBlock2 = json2.content?.find((node: any) => node.type === 'codeBlock');
		expect(codeBlock2?.attrs?.language).toBe('python');

		editor.destroy();
		editor2.destroy();
	});

	it('extracts markdown with code fence from editor', () => {
		const markdown = '```sql\nSELECT * FROM users;\n```';
		const editor = createTestEditor(markdown);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const extractedMarkdown = (editor.storage as any).markdown.getMarkdown();

		expect(extractedMarkdown).toContain('```sql');
		expect(extractedMarkdown).toContain('SELECT * FROM users;');
		expect(extractedMarkdown).toContain('```');

		editor.destroy();
	});

	it('handles code blocks without a specified language', () => {
		const markdown = '```\nplain code\n```';
		const editor = createTestEditor(markdown);

		const json = editor.getJSON();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const codeBlock = json.content?.find((node: any) => node.type === 'codeBlock');

		expect(codeBlock).toBeDefined();
		// Language should be null or empty for unspecified blocks
		expect(codeBlock?.attrs?.language).toBeFalsy();

		editor.destroy();
	});

	it('supports toggling code block via command', () => {
		const editor = createTestEditor('<p>some text</p>');

		// Select all and toggle code block
		editor.commands.selectAll();
		editor.commands.toggleCodeBlock();

		const json = editor.getJSON();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const codeBlock = json.content?.find((node: any) => node.type === 'codeBlock');
		expect(codeBlock).toBeDefined();

		editor.destroy();
	});
});

describe('Markdown round-trip with code blocks', () => {
	it('preserves content when switching between markdown and JSON', () => {
		const originalMarkdown =
			'# Title\n\nSome text\n\n```typescript\nconst greeting: string = "hello";\nconsole.log(greeting);\n```\n\nMore text';
		const editor = createTestEditor(originalMarkdown);

		// Extract markdown
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const extractedMarkdown = (editor.storage as any).markdown.getMarkdown();

		// Re-create editor with extracted markdown
		const editor2 = createTestEditor(extractedMarkdown);

		// Both should produce equivalent JSON
		const json1 = editor.getJSON();
		const json2 = editor2.getJSON();

		// Compare code block nodes
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const codeBlock1 = json1.content?.find((node: any) => node.type === 'codeBlock');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const codeBlock2 = json2.content?.find((node: any) => node.type === 'codeBlock');

		expect(codeBlock1?.attrs?.language).toBe(codeBlock2?.attrs?.language);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect((codeBlock1?.content?.[0] as any)?.text).toBe((codeBlock2?.content?.[0] as any)?.text);

		editor.destroy();
		editor2.destroy();
	});

	it('preserves content when simulating raw mode toggle (markdown -> editor -> markdown)', () => {
		const rawMarkdown = 'Hello **world**\n\n```bash\necho "test"\n```';

		// Simulate: raw markdown -> set into editor (like raw->rendered switch)
		const editor = createTestEditor('');
		editor.commands.setContent(rawMarkdown);

		// Simulate: extract markdown (like rendered->raw switch)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const extractedMarkdown = (editor.storage as any).markdown.getMarkdown();

		expect(extractedMarkdown).toContain('**world**');
		expect(extractedMarkdown).toContain('```bash');
		expect(extractedMarkdown).toContain('echo "test"');

		editor.destroy();
	});
});
