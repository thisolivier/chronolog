import { describe, it, expect } from 'vitest';
import { extractDescriptionLinks, reconcileLinks } from './reconcile-description-links';

describe('extractDescriptionLinks', () => {
	it('extracts a single wiki-link', () => {
		const result = extractDescriptionLinks('Reviewed [[NOTE.001]]');
		expect(result).toEqual([{ noteId: 'NOTE.001' }]);
	});

	it('extracts multiple wiki-links', () => {
		const result = extractDescriptionLinks('See [[NOTE.001]] and [[NOTE.002]]');
		expect(result).toHaveLength(2);
		expect(result[0].noteId).toBe('NOTE.001');
		expect(result[1].noteId).toBe('NOTE.002');
	});

	it('deduplicates same note ID', () => {
		const result = extractDescriptionLinks('See [[NOTE.001]] and [[NOTE.001]] again');
		expect(result).toHaveLength(1);
	});

	it('extracts heading anchors', () => {
		const result = extractDescriptionLinks('See [[NOTE.001#design]]');
		expect(result).toEqual([{ noteId: 'NOTE.001', headingAnchor: 'design' }]);
	});

	it('handles labels (strips them, keeps noteId)', () => {
		const result = extractDescriptionLinks('See [[NOTE.001|My Label]]');
		expect(result).toEqual([{ noteId: 'NOTE.001' }]);
	});

	it('handles heading + label combo', () => {
		const result = extractDescriptionLinks('See [[NOTE.001#design|Design Notes]]');
		expect(result).toEqual([{ noteId: 'NOTE.001', headingAnchor: 'design' }]);
	});

	it('returns empty array for no links', () => {
		const result = extractDescriptionLinks('Just plain text');
		expect(result).toEqual([]);
	});

	it('returns empty array for empty string', () => {
		const result = extractDescriptionLinks('');
		expect(result).toEqual([]);
	});

	it('ignores unclosed brackets', () => {
		const result = extractDescriptionLinks('See [[NOTE.001 without closing');
		expect(result).toEqual([]);
	});

	it('ignores empty brackets', () => {
		const result = extractDescriptionLinks('See [[]]');
		expect(result).toEqual([]);
	});

	it('handles links at start, middle, and end of text', () => {
		const result = extractDescriptionLinks('[[NOTE.001]] middle [[NOTE.002]] end [[NOTE.003]]');
		expect(result).toHaveLength(3);
	});

	it('handles links with surrounding punctuation', () => {
		const result = extractDescriptionLinks('(see [[NOTE.001]]), also [[NOTE.002]].');
		expect(result).toHaveLength(2);
	});
});

describe('reconcileLinks', () => {
	it('returns empty when both lists are empty', () => {
		const result = reconcileLinks([], []);
		expect(result.toAdd).toEqual([]);
		expect(result.toRemove).toEqual([]);
	});

	it('adds all when current is empty', () => {
		const desired = [{ noteId: 'N1' }, { noteId: 'N2' }];
		const result = reconcileLinks([], desired);
		expect(result.toAdd).toEqual(desired);
		expect(result.toRemove).toEqual([]);
	});

	it('removes all when desired is empty', () => {
		const current = [{ noteId: 'N1' }, { noteId: 'N2' }];
		const result = reconcileLinks(current, []);
		expect(result.toAdd).toEqual([]);
		expect(result.toRemove).toEqual([{ noteId: 'N1' }, { noteId: 'N2' }]);
	});

	it('no changes when lists match', () => {
		const current = [{ noteId: 'N1' }, { noteId: 'N2' }];
		const desired = [{ noteId: 'N1' }, { noteId: 'N2' }];
		const result = reconcileLinks(current, desired);
		expect(result.toAdd).toEqual([]);
		expect(result.toRemove).toEqual([]);
	});

	it('adds new and removes stale', () => {
		const current = [{ noteId: 'N1' }, { noteId: 'N2' }];
		const desired = [{ noteId: 'N2' }, { noteId: 'N3' }];
		const result = reconcileLinks(current, desired);
		expect(result.toAdd).toEqual([{ noteId: 'N3' }]);
		expect(result.toRemove).toEqual([{ noteId: 'N1' }]);
	});

	it('handles current links with null headingAnchor', () => {
		const current = [{ noteId: 'N1', headingAnchor: null }];
		const desired = [{ noteId: 'N1' }];
		const result = reconcileLinks(current, desired);
		expect(result.toAdd).toEqual([]);
		expect(result.toRemove).toEqual([]);
	});
});
