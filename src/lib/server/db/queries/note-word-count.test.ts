import { describe, it, expect } from 'vitest';
import { calculateWordCountFromJson, calculateWordCountFromMarkdown } from './note-word-count';

describe('calculateWordCountFromMarkdown', () => {
	it('counts words and ignores markdown syntax', () => {
		const markdown = '# Status: checkout\n\n## Done\n- Reviewed **checkout** flow\n- [x] Dropped [guest step](https://example.com)\n\n---\n\n```\ncode here\n```\n1. Next one\n> quoted';
		// Status checkout Done Reviewed checkout flow Dropped guest step code here Next one quoted
		expect(calculateWordCountFromMarkdown(markdown)).toBe(14);
	});

	it('is 0 for empty text', () => {
		expect(calculateWordCountFromMarkdown('')).toBe(0);
		expect(calculateWordCountFromMarkdown('#\n\n- \n')).toBe(0);
	});

	it('agrees with the TipTap count for the same plain text', () => {
		const json = JSON.stringify({ type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: 'Weekly notes' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Three more words' }] }] });
		expect(calculateWordCountFromJson(json)).toBe(5);
		expect(calculateWordCountFromMarkdown('# Weekly notes\n\nThree more words\n')).toBe(5);
	});
});
