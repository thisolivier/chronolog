// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lockBodyScroll, scrollLockCount } from './scroll-lock';

describe('lockBodyScroll', () => {
	beforeEach(() => {
		document.body.removeAttribute('style');
		Object.defineProperty(window, 'scrollY', { value: 240, configurable: true });
	});

	it('pins the body at the scroll position and restores it on unlock', () => {
		const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
		document.body.style.overflow = 'auto';
		const unlock = lockBodyScroll();
		expect(document.body.style.position).toBe('fixed');
		expect(document.body.style.top).toBe('-240px');
		expect(document.body.style.width).toBe('100%');
		expect(document.body.style.overflow).toBe('hidden');
		expect(document.body.dataset.scrollLocked).toBe('true');
		unlock();
		expect(document.body.style.position).toBe('');
		expect(document.body.style.top).toBe('');
		expect(document.body.style.overflow).toBe('auto');
		expect(document.body.dataset.scrollLocked).toBeUndefined();
		expect(scrollTo).toHaveBeenCalledWith(0, 240);
		expect(scrollLockCount()).toBe(0);
	});

	it('is reference-counted: the inner lock does not release the page early', () => {
		vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
		const unlockModal = lockBodyScroll();
		const unlockSheet = lockBodyScroll();
		unlockSheet();
		unlockSheet();
		expect(document.body.style.position).toBe('fixed');
		expect(scrollLockCount()).toBe(1);
		unlockModal();
		expect(document.body.style.position).toBe('');
		expect(scrollLockCount()).toBe(0);
	});
});
