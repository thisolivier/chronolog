import { describe, expect, it } from 'vitest';
import { appendFormerlyLine } from './formerly-line';

describe('appendFormerlyLine', () => {
	it('uses the line alone when there is no description', () => {
		expect(appendFormerlyLine(null, 'Acme / Rocket')).toBe('Formerly: Acme / Rocket');
		expect(appendFormerlyLine('   ', 'Acme / Rocket')).toBe('Formerly: Acme / Rocket');
	});

	it('appends on a new line and keeps the original text', () => {
		expect(appendFormerlyLine('Kickoff workshop\n', 'Acme / Rocket')).toBe(
			'Kickoff workshop\nFormerly: Acme / Rocket'
		);
	});
});
