import { describe, it, expect } from 'vitest';
import { noteDisplayTitle, truncateNoteTitle, NOTE_TITLE_MAX_LENGTH } from './note-display-title';

const docWithLines = (...lines: string[]) =>
	JSON.stringify({
		type: 'doc',
		content: lines.map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] }))
	});

describe('noteDisplayTitle', () => {
	it('prefers the stored title', () => {
		expect(noteDisplayTitle('Stored', docWithLines('First line'))).toBe('Stored');
	});

	it('falls back to the first content line when the title is empty', () => {
		expect(noteDisplayTitle('', docWithLines('Kickoff notes', 'second'))).toBe('Kickoff notes');
		expect(noteDisplayTitle(null, docWithLines('Kickoff notes'))).toBe('Kickoff notes');
	});

	it('returns null when there is neither title nor content', () => {
		expect(noteDisplayTitle(null, null)).toBeNull();
		expect(noteDisplayTitle('  ', docWithLines())).toBeNull();
	});
});

describe('truncateNoteTitle', () => {
	it('leaves short titles alone and collapses whitespace', () => {
		expect(truncateNoteTitle('  a   b ')).toBe('a b');
	});

	it('cuts long titles on a word boundary with an ellipsis', () => {
		const longTitle = 'word '.repeat(60);
		const result = truncateNoteTitle(longTitle);
		expect(result.length).toBeLessThanOrEqual(NOTE_TITLE_MAX_LENGTH);
		expect(result.endsWith('word…')).toBe(true);
	});
});
