import { describe, it, expect } from 'vitest';
import { buildPrintDocument } from './note-print';

describe('buildPrintDocument', () => {
	it('contains only the note body, its ID and print styles', () => {
		const html = buildPrintDocument({
			title: 'Kickoff <notes>',
			noteId: 'ACME.20261103.001',
			bodyHtml: '<ul><li><p>one</p></li></ul>'
		});
		expect(html).toContain('<title>Kickoff &lt;notes&gt;</title>');
		expect(html).toContain('ACME.20261103.001');
		expect(html).toContain('<ul><li><p>one</p></li></ul>');
		expect(html).toContain('list-style-type: disc');
		expect(html).not.toContain('Loading note');
	});

	it('falls back to the note ID as the document title', () => {
		expect(buildPrintDocument({ title: '', noteId: 'N1', bodyHtml: '' })).toContain('<title>N1</title>');
	});
});
