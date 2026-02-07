import { describe, it, expect } from 'vitest';
import { parseChronologUrl, buildChronologUrl } from './attachment-resolver';

describe('parseChronologUrl', () => {
	it('extracts UUID from a valid chronolog://attachment/ URL', () => {
		const result = parseChronologUrl('chronolog://attachment/550e8400-e29b-41d4-a716-446655440000');
		expect(result).toBe('550e8400-e29b-41d4-a716-446655440000');
	});

	it('extracts a simple ID string', () => {
		const result = parseChronologUrl('chronolog://attachment/abc123');
		expect(result).toBe('abc123');
	});

	it('returns null for empty string', () => {
		expect(parseChronologUrl('')).toBeNull();
	});

	it('returns null for a regular HTTP URL', () => {
		expect(parseChronologUrl('https://example.com/image.png')).toBeNull();
	});

	it('returns null for a chronolog URL without the attachment path', () => {
		expect(parseChronologUrl('chronolog://something/abc')).toBeNull();
	});

	it('returns null for chronolog://attachment/ with no ID', () => {
		expect(parseChronologUrl('chronolog://attachment/')).toBeNull();
	});

	it('returns null for chronolog://attachment/ with nested path', () => {
		expect(parseChronologUrl('chronolog://attachment/abc/def')).toBeNull();
	});

	it('returns null for an undefined-like input cast to string', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect(parseChronologUrl(undefined as any)).toBeNull();
	});

	it('returns null for just the protocol prefix', () => {
		expect(parseChronologUrl('chronolog://')).toBeNull();
	});

	it('returns null for a blob URL', () => {
		expect(parseChronologUrl('blob:http://localhost/abc')).toBeNull();
	});
});

describe('buildChronologUrl', () => {
	it('builds a correct chronolog URL from a UUID', () => {
		const url = buildChronologUrl('550e8400-e29b-41d4-a716-446655440000');
		expect(url).toBe('chronolog://attachment/550e8400-e29b-41d4-a716-446655440000');
	});

	it('builds a correct chronolog URL from a simple ID', () => {
		const url = buildChronologUrl('abc123');
		expect(url).toBe('chronolog://attachment/abc123');
	});

	it('round-trips with parseChronologUrl', () => {
		const originalId = 'round-trip-test-id';
		const url = buildChronologUrl(originalId);
		const parsedId = parseChronologUrl(url);
		expect(parsedId).toBe(originalId);
	});

	it('produces a URL that starts with the chronolog protocol', () => {
		const url = buildChronologUrl('any-id');
		expect(url.startsWith('chronolog://attachment/')).toBe(true);
	});
});
