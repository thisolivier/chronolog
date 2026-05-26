import { describe, it, expect } from 'vitest';
import { sanitizeFilename, buildMarkdownExportContent } from './note-export';

describe('sanitizeFilename', () => {
	it('passes through a simple name unchanged', () => {
		expect(sanitizeFilename('my-note')).toBe('my-note');
	});

	it('replaces slashes with hyphens', () => {
		expect(sanitizeFilename('path/to/note')).toBe('path-to-note');
	});

	it('replaces backslashes with hyphens', () => {
		expect(sanitizeFilename('path\\to\\note')).toBe('path-to-note');
	});

	it('replaces colons with hyphens', () => {
		expect(sanitizeFilename('note: important')).toBe('note- important');
	});

	it('replaces multiple unsafe characters', () => {
		expect(sanitizeFilename('a*b?c"d')).toBe('a-b-c-d');
	});

	it('collapses multiple consecutive hyphens', () => {
		expect(sanitizeFilename('a///b')).toBe('a-b');
	});

	it('trims leading and trailing hyphens', () => {
		expect(sanitizeFilename('/note/')).toBe('note');
	});

	it('trims leading and trailing spaces', () => {
		expect(sanitizeFilename('  note  ')).toBe('note');
	});

	it('limits to 100 characters', () => {
		const longName = 'a'.repeat(150);
		expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(100);
	});

	it('returns untitled-note for empty string', () => {
		expect(sanitizeFilename('')).toBe('untitled-note');
	});

	it('returns untitled-note for string of only unsafe characters', () => {
		expect(sanitizeFilename('***')).toBe('untitled-note');
	});

	it('preserves Unicode characters', () => {
		expect(sanitizeFilename('café-résumé')).toBe('café-résumé');
	});

	it('preserves dots and spaces in middle', () => {
		expect(sanitizeFilename('my note v2.0')).toBe('my note v2.0');
	});
});

describe('buildMarkdownExportContent', () => {
	it('prepends title heading when title is provided', () => {
		const result = buildMarkdownExportContent('My Note', 'Some content here');
		expect(result).toBe('# My Note\n\nSome content here');
	});

	it('does not duplicate title if content already starts with it', () => {
		const result = buildMarkdownExportContent('My Note', '# My Note\nSome content');
		expect(result).toBe('# My Note\nSome content');
	});

	it('returns content as-is when title is null', () => {
		const result = buildMarkdownExportContent(null, 'Content only');
		expect(result).toBe('Content only');
	});

	it('returns content as-is when title is empty string', () => {
		const result = buildMarkdownExportContent('', 'Content only');
		expect(result).toBe('Content only');
	});

	it('returns content as-is when title is whitespace only', () => {
		const result = buildMarkdownExportContent('   ', 'Content only');
		expect(result).toBe('Content only');
	});

	it('prepends title when content has a different heading', () => {
		const result = buildMarkdownExportContent('My Title', '# Different Heading\nContent');
		expect(result).toBe('# My Title\n\n# Different Heading\nContent');
	});

	it('handles empty content with title', () => {
		const result = buildMarkdownExportContent('Title', '');
		expect(result).toBe('# Title\n\n');
	});
});
