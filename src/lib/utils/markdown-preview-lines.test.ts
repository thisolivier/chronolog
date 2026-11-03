import { describe, expect, it } from 'vitest';
import { extractMarkdownPreviewLines } from './markdown-preview-lines';

describe('markdown preview lines', () => {
	it('strips heading, list and quote markers and skips blank lines', () => {
		expect(extractMarkdownPreviewLines('# Weekly status\n\n- [x] shipped login\n> quote')).toEqual({ firstLine: 'Weekly status', secondLine: 'shipped login' });
	});

	it('returns empty lines for empty content', () => {
		expect(extractMarkdownPreviewLines(null)).toEqual({ firstLine: '', secondLine: '' });
	});
});
