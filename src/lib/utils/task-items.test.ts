import { describe, it, expect } from 'vitest';
import { extractTaskItems } from './task-items';

describe('extractTaskItems', () => {
	it('finds open and done items with their depth', () => {
		const markdown = '# Plan\n\n- [ ] call Jane\n- [x] send report\n  - [ ] nested follow-up\n    - [X] deeper done\n- [ ] back at top';
		expect(extractTaskItems(markdown)).toEqual([
			{ text: 'call Jane', checked: false, depth: 0, line: 3 },
			{ text: 'send report', checked: true, depth: 0, line: 4 },
			{ text: 'nested follow-up', checked: false, depth: 1, line: 5 },
			{ text: 'deeper done', checked: true, depth: 2, line: 6 },
			{ text: 'back at top', checked: false, depth: 0, line: 7 }
		]);
	});

	it('reads the `*` marker the editor writes next to a bullet list, and tasks nested under bullets', () => {
		const markdown = '- topic\n  - [ ] under a bullet\n\n* [ ] starred';
		expect(extractTaskItems(markdown).map((item) => [item.text, item.depth])).toEqual([
			['under a bullet', 0],
			['starred', 0]
		]);
	});

	it('ignores code blocks, plain bullets, empty items and text that only looks like a task', () => {
		const markdown = '```md\n- [ ] in code\n```\n- plain bullet\n- [ ]\n- [x] \nSee [ ] inline\n> - [ ] quoted\n~~~\n- [ ] tilde fence\n~~~\n- [ ] real one';
		expect(extractTaskItems(markdown).map((item) => item.text)).toEqual(['real one']);
	});

	it('unescapes markdown escapes but keeps wiki-links', () => {
		expect(extractTaskItems('- [ ] Review \\*draft\\* with [[ACME.20261104.001]]')[0].text).toBe('Review *draft* with [[ACME.20261104.001]]');
	});

	it('handles empty input', () => {
		expect(extractTaskItems('')).toEqual([]);
		expect(extractTaskItems(null)).toEqual([]);
	});
});
