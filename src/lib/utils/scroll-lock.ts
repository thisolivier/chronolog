/**
 * Page scroll lock for full-window modals and sheets (sprint 066-TR follow-up). iOS Safari ignores
 * `overflow: hidden` on the body for touch scrolling and rubber-bands the document under a fixed
 * overlay, so the lock pins the body instead: `position: fixed; top: -<scrollY>px; width: 100%;
 * overflow: hidden`, and puts the scroll position back on unlock. Reference-counted: a sheet
 * opening inside a modal takes a second lock, and only the last unlock releases the page.
 *
 *   $effect(() => lockBodyScroll());   // the returned function unlocks
 */

let lockCount = 0;
let savedScrollY = 0;
let savedStyle: Pick<CSSStyleDeclaration, 'position' | 'top' | 'width' | 'overflow'> | null = null;

/** Lock the page's scroll; returns the matching unlock (calling it twice is harmless) */
export function lockBodyScroll(): () => void {
	if (typeof document === 'undefined') return () => {};
	const body = document.body;
	if (lockCount === 0) {
		savedScrollY = window.scrollY;
		savedStyle = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
		body.style.position = 'fixed';
		body.style.top = `-${savedScrollY}px`;
		body.style.width = '100%';
		body.style.overflow = 'hidden';
		body.dataset.scrollLocked = 'true';
	}
	lockCount += 1;
	let isReleased = false;
	return () => {
		if (isReleased) return;
		isReleased = true;
		lockCount -= 1;
		if (lockCount > 0 || !savedStyle) return;
		Object.assign(body.style, savedStyle);
		delete body.dataset.scrollLocked;
		savedStyle = null;
		window.scrollTo(0, savedScrollY);
	};
}

/** How many locks are held (tests) */
export function scrollLockCount(): number {
	return lockCount;
}
