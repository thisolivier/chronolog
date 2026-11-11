/**
 * Pull-down-to-dismiss for the phone's contract sheet (066-TR follow-up, the owner's request: "scrolling
 * to the top and pulling down ... triggers a dismiss"). No library: touch listeners on the sheet panel.
 * A drag takes over when it starts on the handle, header or footer, or on the list while the list
 * is scrolled to the top and the finger moves down; the sheet then follows the finger (never above
 * its resting place) and the backdrop lightens with it. On release it closes past 96 px or on a
 * clear downward flick (0.5 px/ms over the last 100 ms), otherwise it springs back. Any other
 * gesture is left to the list's own scrolling. The pure rules are exported for unit tests.
 */

export const DISMISS_DISTANCE = 96;
export const DISMISS_VELOCITY = 0.5;
/** Movement before the gesture is classified, so taps on All / None / Done stay taps */
const TOUCH_SLOP = 6;
const VELOCITY_WINDOW = 100;
const SETTLE_MILLISECONDS = 180;

export type SheetRelease = 'dismiss' | 'restore';

/** Close, or spring back, for a release `distance` px below rest moving at `velocity` px/ms (down positive) */
export function decideSheetRelease({ distance, velocity }: { distance: number; velocity: number }): SheetRelease {
	return distance > DISMISS_DISTANCE || (distance > 0 && velocity > DISMISS_VELOCITY) ? 'dismiss' : 'restore';
}

/** Whether the sheet takes the gesture over from the list (decided once, after the touch slop) */
export function shouldTakeOver({ startedOnList, listAtTop, deltaY }: { startedOnList: boolean; listAtTop: boolean; deltaY: number }): boolean {
	if (deltaY <= 0) return false;
	return !startedOnList || listAtTop;
}

/** How far the sheet sits below rest for a finger `deltaY` px down: never up, softer past half its height */
export function sheetOffset(deltaY: number, sheetHeight: number): number {
	if (deltaY <= 0) return 0;
	const half = sheetHeight / 2;
	return deltaY <= half ? deltaY : half + (deltaY - half) / 2;
}

/** Downward speed in px/ms over the last 100 ms of samples (the release point included) */
export function releaseVelocity(samples: { time: number; y: number }[]): number {
	const last = samples[samples.length - 1];
	if (!last) return 0;
	const recent = samples.filter((sample) => last.time - sample.time <= VELOCITY_WINDOW);
	const first = recent[0];
	const elapsed = last.time - first.time;
	return elapsed > 0 ? (last.y - first.y) / elapsed : 0;
}

type SheetDragOptions = {
	/** The list that scrolls inside the sheet */
	scroller: HTMLElement;
	/** The dimmed layer behind the sheet, lightened while dragging */
	backdrop: HTMLElement;
	/** The sheet's normal close (Done's path) */
	onDismiss: () => void;
};

/** Attach the gesture to the sheet panel; returns the detach (call from an `$effect`) */
export function attachSheetDrag(sheet: HTMLElement, { scroller, backdrop, onDismiss }: SheetDragOptions): () => void {
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	let gesture: 'idle' | 'pending' | 'dragging' | 'ignored' = 'idle';
	let startY = 0;
	let startedOnList = false;
	let listAtTop = true;
	let samples: { time: number; y: number }[] = [];
	let settleTimer: ReturnType<typeof setTimeout> | undefined;

	const place = (offset: number, animate: boolean) => {
		const transition = animate && !reducedMotion ? `${SETTLE_MILLISECONDS}ms ease-out` : 'none';
		sheet.style.transition = transition === 'none' ? 'none' : `transform ${transition}`;
		backdrop.style.transition = transition === 'none' ? 'none' : `background-color ${transition}`;
		sheet.style.transform = offset > 0 ? `translateY(${offset}px)` : '';
		const dim = 40 * Math.max(0, 1 - offset / Math.max(sheet.offsetHeight, 1));
		backdrop.style.backgroundColor = offset > 0 ? `color-mix(in oklab, var(--color-chalk-950) ${dim}%, transparent)` : '';
	};

	const firstTouchY = (event: TouchEvent) => (event.touches[0] ?? event.changedTouches[0])?.clientY ?? startY;

	const handleStart = (event: TouchEvent) => {
		if (event.touches.length !== 1) return;
		clearTimeout(settleTimer);
		gesture = 'pending';
		startY = firstTouchY(event);
		startedOnList = event.target instanceof Node && scroller.contains(event.target);
		listAtTop = scroller.scrollTop <= 0;
		samples = [{ time: event.timeStamp, y: startY }];
	};

	const handleMove = (event: TouchEvent) => {
		if (gesture === 'idle' || gesture === 'ignored') return;
		const deltaY = firstTouchY(event) - startY;
		if (gesture === 'pending') {
			if (Math.abs(deltaY) < TOUCH_SLOP) return;
			gesture = shouldTakeOver({ startedOnList, listAtTop, deltaY }) ? 'dragging' : 'ignored';
			if (gesture === 'ignored') return;
		}
		if (event.cancelable) event.preventDefault();
		samples.push({ time: event.timeStamp, y: startY + deltaY });
		place(sheetOffset(deltaY, sheet.offsetHeight), false);
	};

	const handleEnd = (event: TouchEvent) => {
		const wasDragging = gesture === 'dragging';
		gesture = 'idle';
		if (!wasDragging) return;
		const deltaY = firstTouchY(event) - startY;
		samples.push({ time: event.timeStamp, y: startY + deltaY });
		const decision = decideSheetRelease({ distance: sheetOffset(deltaY, sheet.offsetHeight), velocity: releaseVelocity(samples) });
		if (decision === 'restore') {
			place(0, true);
			return;
		}
		if (reducedMotion) return onDismiss();
		place(sheet.offsetHeight, true);
		settleTimer = setTimeout(onDismiss, SETTLE_MILLISECONDS);
	};

	/** The system took the touch (a call, a gesture): never a dismiss, back to rest */
	const handleCancel = () => {
		if (gesture === 'dragging') place(0, true);
		gesture = 'idle';
	};

	sheet.addEventListener('touchstart', handleStart, { passive: true });
	sheet.addEventListener('touchmove', handleMove, { passive: false });
	sheet.addEventListener('touchend', handleEnd);
	sheet.addEventListener('touchcancel', handleCancel);
	return () => {
		clearTimeout(settleTimer);
		sheet.removeEventListener('touchstart', handleStart);
		sheet.removeEventListener('touchmove', handleMove);
		sheet.removeEventListener('touchend', handleEnd);
		sheet.removeEventListener('touchcancel', handleCancel);
	};
}
