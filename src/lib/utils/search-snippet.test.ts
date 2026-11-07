import { describe, it, expect } from 'vitest';
import { buildSearchSnippet, findMatchRanges, plainTextFromMarkdown, snippetParts } from './search-snippet';

describe('findMatchRanges', () => {
	it('finds every case-insensitive, non-overlapping occurrence', () => {
		expect(findMatchRanges('Budget, BUDGET and budgets', 'budget')).toEqual([
			{ start: 0, end: 6 },
			{ start: 8, end: 14 },
			{ start: 19, end: 25 }
		]);
		expect(findMatchRanges('aaaa', 'aa')).toEqual([
			{ start: 0, end: 2 },
			{ start: 2, end: 4 }
		]);
		expect(findMatchRanges('anything', '')).toEqual([]);
	});

	it('takes several needles, sorted, overlaps merged (058-DR)', () => {
		expect(findMatchRanges('Plan the roles matrix; roles later', ['roles matrix', 'roles', 'matrix', 'plan'])).toEqual([
			{ start: 0, end: 4 },
			{ start: 9, end: 21 },
			{ start: 23, end: 28 }
		]);
		expect(findMatchRanges('anything', [])).toEqual([]);
	});
});

describe('plainTextFromMarkdown', () => {
	it('drops markdown syntax and collapses whitespace', () => {
		const markdown = '# Heading\n\n- [ ] task **bold** `code`\n> quote [[ACME.20261104.001|Kickoff]] [site](https://x.io)';
		expect(plainTextFromMarkdown(markdown)).toBe('Heading task bold code quote Kickoff site');
	});
});

describe('buildSearchSnippet', () => {
	const longText = `${'lorem ipsum '.repeat(20)}the quarterly budget review ${'dolor sit amet '.repeat(20)}`.trim();

	it('centres on the first match, cuts at words and marks the cuts', () => {
		const snippet = buildSearchSnippet(longText, 'Budget');
		expect(snippet.text.startsWith('…')).toBe(true);
		expect(snippet.text.endsWith('…')).toBe(true);
		expect(snippet.text.length).toBeLessThanOrEqual(185);
		expect(snippet.matches).toHaveLength(1);
		const [match] = snippet.matches;
		expect(snippet.text.slice(match.start, match.end)).toBe('budget');
		expect(snippet.text).not.toMatch(/…\S*m …/); // no word cut in half at the start
	});

	it('keeps short text whole, with every match', () => {
		const snippet = buildSearchSnippet('Budget call about the budget', 'budget');
		expect(snippet).toEqual({ text: 'Budget call about the budget', matches: [{ start: 0, end: 6 }, { start: 22, end: 28 }] });
	});

	it('returns the start of the text when nothing matches', () => {
		const snippet = buildSearchSnippet(longText, 'zebra');
		expect(snippet.text.startsWith('lorem')).toBe(true);
		expect(snippet.matches).toEqual([]);
	});
});

describe('snippetParts', () => {
	it('splits into plain and matched parts', () => {
		expect(snippetParts({ text: 'a budget b', matches: [{ start: 2, end: 8 }] })).toEqual([
			{ text: 'a ', isMatch: false },
			{ text: 'budget', isMatch: true },
			{ text: ' b', isMatch: false }
		]);
	});
});
