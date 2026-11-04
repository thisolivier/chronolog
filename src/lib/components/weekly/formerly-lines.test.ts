import { describe, expect, it } from 'vitest';
import { splitFormerlyLines } from './formerly-lines';
import { appendFormerlyLine } from '$lib/server/db/queries/formerly-line';

describe('splitFormerlyLines', () => {
	it('separates the line appendFormerlyLine adds', () => {
		const description = appendFormerlyLine('Sprint review with the client', 'Legacy Phase');
		expect(splitFormerlyLines(description)).toEqual({
			body: 'Sprint review with the client',
			formerlyLines: ['Formerly: Legacy Phase']
		});
	});

	it('keeps several Formerly lines in order', () => {
		const description = appendFormerlyLine(appendFormerlyLine('Work', 'Acme / Old'), 'Phase 1');
		expect(splitFormerlyLines(description).formerlyLines).toEqual(['Formerly: Acme / Old', 'Formerly: Phase 1']);
	});

	it('handles a description that is only a Formerly line', () => {
		expect(splitFormerlyLines('Formerly: Legacy Phase')).toEqual({ body: '', formerlyLines: ['Formerly: Legacy Phase'] });
	});

	it('leaves other text, multi-line descriptions and inline mentions alone', () => {
		expect(splitFormerlyLines('Line one\nLine two')).toEqual({ body: 'Line one\nLine two', formerlyLines: [] });
		expect(splitFormerlyLines('Formerly known as Acme')).toEqual({ body: 'Formerly known as Acme', formerlyLines: [] });
		expect(splitFormerlyLines('Notes. Formerly: inline')).toEqual({ body: 'Notes. Formerly: inline', formerlyLines: [] });
	});

	it('copes with null, empty and CRLF text', () => {
		expect(splitFormerlyLines(null)).toEqual({ body: '', formerlyLines: [] });
		expect(splitFormerlyLines('Work\r\nFormerly: X')).toEqual({ body: 'Work', formerlyLines: ['Formerly: X'] });
	});
});
