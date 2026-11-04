// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { ATTACHMENT_LINK_PROTOCOLS, attachmentHrefFromTarget, openAttachment } from './attachment-link';
import { revokeAllTrackedUrls } from './attachment-resolver';
import { cleanEditorHtml } from '../note-print';

const ATTACHMENT_URL = 'chronolog://attachment/550e8400-e29b-41d4-a716-446655440000';
const PDF_MARKDOWN = `Signed copy: [Statement of work.pdf](${ATTACHMENT_URL})`;

function makeEditor(protocols: string[]) {
	return new Editor({
		extensions: [StarterKit.configure({ link: { openOnClick: false, protocols } }), Markdown],
		content: PDF_MARKDOWN
	});
}

const markdownOf = (editor: Editor) =>
	(editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	revokeAllTrackedUrls();
});

describe('attachment links in the editor', () => {
	it('keeps a chronolog:// link (filename as text) through parse and save', () => {
		const editor = makeEditor(ATTACHMENT_LINK_PROTOCOLS);
		expect(editor.getHTML()).toContain(`href="${ATTACHMENT_URL}"`);
		expect(editor.getHTML()).toContain('>Statement of work.pdf</a>');
		expect(markdownOf(editor)).toBe(PDF_MARKDOWN);
		editor.destroy();
	});

	it('drops the href without the chronolog protocol registered (why NoteEditor passes it)', () => {
		const editor = makeEditor([]);
		expect(editor.getHTML()).not.toContain(ATTACHMENT_URL);
		editor.destroy();
	});

	it('finds the attachment href from a click inside the link, and ignores other links', () => {
		document.body.innerHTML = `<p><a href="${ATTACHMENT_URL}"><strong id="inner">SOW.pdf</strong></a> <a id="web" href="https://example.com">web</a></p>`;
		expect(attachmentHrefFromTarget(document.getElementById('inner'))).toBe(ATTACHMENT_URL);
		expect(attachmentHrefFromTarget(document.getElementById('web'))).toBeNull();
		expect(attachmentHrefFromTarget(null)).toBeNull();
	});
});

describe('openAttachment', () => {
	it('opens a tab at once and points it at the blob URL of the fetched file', async () => {
		const fetchMock = vi.fn(async () => new Response('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf' } }));
		vi.stubGlobal('fetch', fetchMock);
		URL.createObjectURL = vi.fn(() => 'blob:http://localhost/abc');
		URL.revokeObjectURL = vi.fn();
		const newTab = { location: { href: 'about:blank' }, close: vi.fn() };
		const opener = { open: vi.fn().mockReturnValue(newTab) };

		expect(await openAttachment(ATTACHMENT_URL, opener as unknown as Window)).toBe(true);
		expect(opener.open).toHaveBeenCalledWith('about:blank', '_blank');
		expect(fetchMock).toHaveBeenCalledWith('/api/attachments/550e8400-e29b-41d4-a716-446655440000');
		expect(newTab.location.href).toBe('blob:http://localhost/abc');
	});

	it('never opens an SVG as a page (its scripts would run with the app origin)', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } })));
		URL.createObjectURL = vi.fn(() => 'blob:http://localhost/svg');
		URL.revokeObjectURL = vi.fn();
		const newTab = { location: { href: 'about:blank' }, close: vi.fn() };
		const opener = { open: vi.fn().mockReturnValue(newTab) };
		expect(await openAttachment(ATTACHMENT_URL, opener as unknown as Window)).toBe(false);
		expect(newTab.close).toHaveBeenCalled();
		expect(newTab.location.href).toBe('about:blank');
	});

	it('closes the tab again when the file cannot be fetched', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('gone', { status: 404 })));
		const newTab = { location: { href: 'about:blank' }, close: vi.fn() };
		const opener = { open: vi.fn().mockReturnValue(newTab) };
		expect(await openAttachment(ATTACHMENT_URL, opener as unknown as Window)).toBe(false);
		expect(newTab.close).toHaveBeenCalled();
	});
});

describe('PDF export (print)', () => {
	it('prints an attachment link as its filename, not a dead chronolog:// link', () => {
		const root = document.createElement('div');
		root.innerHTML = `<p>Signed copy: <a href="${ATTACHMENT_URL}" target="_blank">Statement of work.pdf</a></p>`;
		const html = cleanEditorHtml(root);
		expect(html).toContain('<span class="attachment-name">Statement of work.pdf</span>');
		expect(html).not.toContain('chronolog://');
	});
});
