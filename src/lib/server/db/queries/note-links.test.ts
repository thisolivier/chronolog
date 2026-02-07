import { describe, it, expect } from 'vitest';
import { parseWikiLinks } from './wiki-link-parser';

describe('parseWikiLinks', () => {
	const sourceNoteId = 'SRC.20260207.001';

	it('should parse a simple wiki-link [[NOTE.ID]]', () => {
		const content = 'Some text [[TARGET.20260207.002]] more text';
		const links = parseWikiLinks(sourceNoteId, content);

		expect(links).toEqual([
			{ targetNoteId: 'TARGET.20260207.002', headingAnchor: null }
		]);
	});

	it('should parse a wiki-link with label [[NOTE.ID|label]]', () => {
		const content = 'See [[TARGET.20260207.002|my label]] for details';
		const links = parseWikiLinks(sourceNoteId, content);

		expect(links).toEqual([
			{ targetNoteId: 'TARGET.20260207.002', headingAnchor: null }
		]);
	});

	it('should parse a wiki-link with heading anchor [[NOTE.ID#heading]]', () => {
		const content = 'Refer to [[TARGET.20260207.002#section-one]]';
		const links = parseWikiLinks(sourceNoteId, content);

		expect(links).toEqual([
			{ targetNoteId: 'TARGET.20260207.002', headingAnchor: 'section-one' }
		]);
	});

	it('should parse a wiki-link with heading and label [[NOTE.ID#heading|label]]', () => {
		const content = 'See [[TARGET.20260207.002#section-one|Section One]] here';
		const links = parseWikiLinks(sourceNoteId, content);

		expect(links).toEqual([
			{ targetNoteId: 'TARGET.20260207.002', headingAnchor: 'section-one' }
		]);
	});

	it('should parse multiple wiki-links', () => {
		const content = '[[A.20260207.001]] and [[B.20260207.002]] and [[C.20260207.003]]';
		const links = parseWikiLinks(sourceNoteId, content);

		expect(links).toHaveLength(3);
		expect(links[0].targetNoteId).toBe('A.20260207.001');
		expect(links[1].targetNoteId).toBe('B.20260207.002');
		expect(links[2].targetNoteId).toBe('C.20260207.003');
	});

	it('should deduplicate links with the same target and anchor', () => {
		const content = '[[TARGET.20260207.002]] some text [[TARGET.20260207.002]]';
		const links = parseWikiLinks(sourceNoteId, content);

		expect(links).toHaveLength(1);
		expect(links[0].targetNoteId).toBe('TARGET.20260207.002');
	});

	it('should keep links with same target but different anchors as separate entries', () => {
		const content = '[[TARGET.20260207.002#heading-a]] and [[TARGET.20260207.002#heading-b]]';
		const links = parseWikiLinks(sourceNoteId, content);

		expect(links).toHaveLength(2);
		expect(links[0].headingAnchor).toBe('heading-a');
		expect(links[1].headingAnchor).toBe('heading-b');
	});

	it('should keep link with anchor and link without anchor as separate entries', () => {
		const content = '[[TARGET.20260207.002]] and [[TARGET.20260207.002#heading]]';
		const links = parseWikiLinks(sourceNoteId, content);

		expect(links).toHaveLength(2);
		expect(links[0]).toEqual({ targetNoteId: 'TARGET.20260207.002', headingAnchor: null });
		expect(links[1]).toEqual({ targetNoteId: 'TARGET.20260207.002', headingAnchor: 'heading' });
	});

	it('should filter out self-links', () => {
		const content = `[[${sourceNoteId}]] and [[TARGET.20260207.002]]`;
		const links = parseWikiLinks(sourceNoteId, content);

		expect(links).toHaveLength(1);
		expect(links[0].targetNoteId).toBe('TARGET.20260207.002');
	});

	it('should filter out self-links even with anchors', () => {
		const content = `[[${sourceNoteId}#heading]] and [[TARGET.20260207.002]]`;
		const links = parseWikiLinks(sourceNoteId, content);

		expect(links).toHaveLength(1);
		expect(links[0].targetNoteId).toBe('TARGET.20260207.002');
	});

	it('should return empty array for content with no wiki-links', () => {
		const content = 'Just some regular text without any links.';
		const links = parseWikiLinks(sourceNoteId, content);

		expect(links).toEqual([]);
	});

	it('should return empty array for empty string', () => {
		const links = parseWikiLinks(sourceNoteId, '');

		expect(links).toEqual([]);
	});

	it('should trim whitespace from note IDs', () => {
		const content = '[[  TARGET.20260207.002  ]]';
		const links = parseWikiLinks(sourceNoteId, content);

		expect(links).toEqual([
			{ targetNoteId: 'TARGET.20260207.002', headingAnchor: null }
		]);
	});

	it('should trim whitespace from heading anchors', () => {
		const content = '[[TARGET.20260207.002#  heading  ]]';
		const links = parseWikiLinks(sourceNoteId, content);

		expect(links).toEqual([
			{ targetNoteId: 'TARGET.20260207.002', headingAnchor: 'heading' }
		]);
	});

	it('should handle wiki-links across multiple lines', () => {
		const content = `
# My Note

Some text with [[TARGET.20260207.001]] inline.

Another paragraph referencing [[TARGET.20260207.002#summary|the summary]].

- List item with [[TARGET.20260207.003]]
		`;
		const links = parseWikiLinks(sourceNoteId, content);

		expect(links).toHaveLength(3);
		expect(links[0].targetNoteId).toBe('TARGET.20260207.001');
		expect(links[1].targetNoteId).toBe('TARGET.20260207.002');
		expect(links[1].headingAnchor).toBe('summary');
		expect(links[2].targetNoteId).toBe('TARGET.20260207.003');
	});

	it('should not match incomplete wiki-link syntax', () => {
		const content = '[TARGET.20260207.002] and [TARGET.20260207.003]] and [[TARGET.20260207.004';
		const links = parseWikiLinks(sourceNoteId, content);

		expect(links).toEqual([]);
	});
});
