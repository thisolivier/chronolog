// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { copyText } from './copy-text';

describe('copyText', () => {
	it('uses the Clipboard API when it is there', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		expect(await copyText('INTL.20261104.0042', { clipboard: { writeText }, document })).toBe(true);
		expect(writeText).toHaveBeenCalledWith('INTL.20261104.0042');
	});

	it('falls back to execCommand when the Clipboard API refuses', async () => {
		const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
		const execCommand = vi.fn().mockReturnValue(true);
		Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
		expect(await copyText('ACME.20261105.0001', { clipboard: { writeText }, document })).toBe(true);
		expect(execCommand).toHaveBeenCalledWith('copy');
		expect(document.querySelector('textarea')).toBeNull();
	});

	it('reports failure when neither way works, without throwing', async () => {
		Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
		expect(await copyText('X', { clipboard: null, document })).toBe(false);
		expect(await copyText('X', { clipboard: null, document: null })).toBe(false);
	});
});
