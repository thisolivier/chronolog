import { describe, expect, it } from 'vitest';
import { collectWikiLinkNoteIds, markdownLinksToText, parseWikiLinkText, wikiLinkPlainText } from './wiki-link-text';
import { extractPreviewLines } from './extract-preview-lines';
import { extractMarkdownPreviewLines } from './markdown-preview-lines';
import { noteDisplayTitle } from './note-display-title';

const titles: Record<string, string> = { 'ACME.20261101.001': 'Alpha note' };
const resolveNoteTitle = (noteId: string) => titles[noteId];

const paragraph = (...content: object[]) => ({ type: 'paragraph', content });
const text = (value: string) => ({ type: 'text', text: value });
const wikiLink = (noteId: string, label: string | null = noteId) => ({ type: 'wikiLink', attrs: { noteId, label, headingAnchor: null } });
const doc = (...blocks: object[]) => JSON.stringify({ type: 'doc', content: blocks });

const betaDoc = doc(paragraph(text('Beta note links to '), wikiLink('ACME.20261101.001')), paragraph(text('Second')));

describe('wiki-link text', () => {
	it('parses the four wiki-link forms', () => {
		expect(parseWikiLinkText('A.1')).toEqual({ noteId: 'A.1', headingAnchor: undefined, label: 'A.1' });
		expect(parseWikiLinkText('A.1#intro|Read me')).toEqual({ noteId: 'A.1', headingAnchor: 'intro', label: 'Read me' });
	});

	it('reads a link as its label, the resolved title, else the ID', () => {
		expect(wikiLinkPlainText('A.1', 'Label', { resolveNoteTitle })).toBe('Label');
		expect(wikiLinkPlainText('ACME.20261101.001', 'ACME.20261101.001', { resolveNoteTitle })).toBe('Alpha note');
		expect(wikiLinkPlainText('UNKNOWN.1', null, { resolveNoteTitle })).toBe('UNKNOWN.1');
	});

	it('collects link targets from JSON and markdown once each', () => {
		expect(collectWikiLinkNoteIds(betaDoc, 'see [[B.2|bee]] and [[ACME.20261101.001]]')).toEqual(['ACME.20261101.001', 'B.2']);
		expect(collectWikiLinkNoteIds('not json', null)).toEqual([]);
	});

	it('turns markdown links into their text', () => {
		expect(markdownLinksToText('See [report.pdf](chronolog://attachment/abc) and ![chart](chronolog://attachment/def)')).toBe(
			'See report.pdf and chart'
		);
		expect(markdownLinksToText('Links to [[ACME.20261101.001]]', { resolveNoteTitle })).toBe('Links to Alpha note');
	});
});

describe('previews and titles with links (sprint 043-CL)', () => {
	it('keeps wiki-link text in JSON previews', () => {
		expect(extractPreviewLines(betaDoc, { resolveNoteTitle })).toEqual({ firstLine: 'Beta note links to Alpha note', secondLine: 'Second' });
		expect(extractPreviewLines(betaDoc).firstLine).toBe('Beta note links to ACME.20261101.001');
	});

	it('reads list items as lines', () => {
		const listDoc = doc({ type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('First item'))] }] });
		expect(extractPreviewLines(listDoc).firstLine).toBe('First item');
	});

	it('shows link text, not raw markdown, in markdown previews', () => {
		expect(extractMarkdownPreviewLines('# Filed\n[invoice.pdf](chronolog://attachment/1234)')).toEqual({
			firstLine: 'Filed',
			secondLine: 'invoice.pdf'
		});
		expect(extractMarkdownPreviewLines('Beta note links to [[ACME.20261101.001]]', { resolveNoteTitle }).firstLine).toBe(
			'Beta note links to Alpha note'
		);
	});

	it('derives the title again when the stored one dropped the links', () => {
		expect(noteDisplayTitle('Beta note links to', betaDoc, { resolveNoteTitle })).toBe('Beta note links to Alpha note');
		// A title set on purpose is kept
		expect(noteDisplayTitle('Beta', betaDoc, { resolveNoteTitle })).toBe('Beta');
	});
});
