import { describe, it, expect } from 'vitest';
import { extractPreviewLines } from '$lib/utils/extract-preview-lines';

describe('extractPreviewLines', () => {
	it('should return empty strings for null input', () => {
		const result = extractPreviewLines(null);
		expect(result).toEqual({ firstLine: '', secondLine: '' });
	});

	it('should return empty strings for invalid JSON', () => {
		const result = extractPreviewLines('not valid json');
		expect(result).toEqual({ firstLine: '', secondLine: '' });
	});

	it('should return empty strings for empty doc', () => {
		const result = extractPreviewLines(JSON.stringify({ type: 'doc', content: [] }));
		expect(result).toEqual({ firstLine: '', secondLine: '' });
	});

	it('should extract first line from a single paragraph', () => {
		const doc = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Hello world' }]
				}
			]
		};
		const result = extractPreviewLines(JSON.stringify(doc));
		expect(result).toEqual({ firstLine: 'Hello world', secondLine: '' });
	});

	it('should extract two lines from two paragraphs', () => {
		const doc = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'First paragraph' }]
				},
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Second paragraph' }]
				}
			]
		};
		const result = extractPreviewLines(JSON.stringify(doc));
		expect(result).toEqual({ firstLine: 'First paragraph', secondLine: 'Second paragraph' });
	});

	it('should skip empty blocks', () => {
		const doc = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: '  ' }]
				},
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Actual content' }]
				},
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Second line' }]
				}
			]
		};
		const result = extractPreviewLines(JSON.stringify(doc));
		expect(result).toEqual({ firstLine: 'Actual content', secondLine: 'Second line' });
	});

	it('should handle headings as blocks', () => {
		const doc = {
			type: 'doc',
			content: [
				{
					type: 'heading',
					attrs: { level: 1 },
					content: [{ type: 'text', text: 'My Heading' }]
				},
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Body text here' }]
				}
			]
		};
		const result = extractPreviewLines(JSON.stringify(doc));
		expect(result).toEqual({ firstLine: 'My Heading', secondLine: 'Body text here' });
	});

	it('should concatenate multiple text nodes in a block', () => {
		const doc = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [
						{ type: 'text', text: 'Hello ' },
						{ type: 'text', text: 'world', marks: [{ type: 'bold' }] }
					]
				}
			]
		};
		const result = extractPreviewLines(JSON.stringify(doc));
		expect(result).toEqual({ firstLine: 'Hello world', secondLine: '' });
	});

	it('should handle blocks with no content array', () => {
		const doc = {
			type: 'doc',
			content: [
				{ type: 'horizontalRule' },
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'After the rule' }]
				}
			]
		};
		const result = extractPreviewLines(JSON.stringify(doc));
		expect(result).toEqual({ firstLine: 'After the rule', secondLine: '' });
	});

	it('should only return first two non-empty lines', () => {
		const doc = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Line 1' }]
				},
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Line 2' }]
				},
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Line 3' }]
				}
			]
		};
		const result = extractPreviewLines(JSON.stringify(doc));
		expect(result).toEqual({ firstLine: 'Line 1', secondLine: 'Line 2' });
	});

	it('should handle missing content property on doc', () => {
		const result = extractPreviewLines(JSON.stringify({ type: 'doc' }));
		expect(result).toEqual({ firstLine: '', secondLine: '' });
	});
});
