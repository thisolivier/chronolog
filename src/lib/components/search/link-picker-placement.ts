/**
 * Where the `[[` picker goes (059-DR, SR-07). Pure, so it is unit-tested; callers pass the active
 * query's rectangle and the *visual* viewport (`window.visualViewport`: on a phone it is the part
 * of the page above the software keyboard). Coordinates are those of `position: fixed`.
 *
 * - Desktop: anchored under the query, flipped above it when there is more room there, kept
 *   inside the viewport sideways; the list scrolls inside its maximum height.
 * - Phone: full width (minus margins); under the query when the room above the keyboard holds the
 *   list (or most of it), else above the query, so the query stays visible either way. With no
 *   keyboard the visual viewport is the whole screen, so the same rule uses the available space.
 */
export type PickerRect = { top: number; bottom: number; left: number };
export type PickerViewport = { top: number; left: number; width: number; height: number };
export type PickerPlacement = { top: number; left: number; width: number; maxHeight: number; side: 'below' | 'above' };

export const PICKER_MARGIN = 8;
const GAP = 4;
const DESKTOP_WIDTH = 460;
const DESKTOP_MIN_WIDTH = 260;
const DESKTOP_MAX_HEIGHT = 320;
const PHONE_MAX_HEIGHT = 360;
/** Below this, a side is too cramped to prefer (about two and a half rows) */
const COMFORTABLE_HEIGHT = 150;

export function placeLinkPicker(input: {
	anchor: PickerRect;
	viewport: PickerViewport;
	/** The list's natural height (all rows) */
	contentHeight: number;
	isPhone: boolean;
}): PickerPlacement {
	const { anchor, viewport, isPhone } = input;
	const viewportBottom = viewport.top + viewport.height;
	const viewportRight = viewport.left + viewport.width;
	const widest = viewport.width - PICKER_MARGIN * 2;
	const width = isPhone ? widest : Math.max(Math.min(DESKTOP_WIDTH, widest), Math.min(DESKTOP_MIN_WIDTH, widest));
	const left = isPhone
		? viewport.left + PICKER_MARGIN
		: Math.max(viewport.left + PICKER_MARGIN, Math.min(anchor.left, viewportRight - PICKER_MARGIN - width));

	const cap = isPhone ? PHONE_MAX_HEIGHT : DESKTOP_MAX_HEIGHT;
	const wanted = Math.min(Math.max(input.contentHeight, 0) || cap, cap);
	// The query itself may be scrolled out of the visual viewport (under the keyboard): clamp it
	const anchorTop = Math.min(Math.max(anchor.top, viewport.top), viewportBottom);
	const anchorBottom = Math.min(Math.max(anchor.bottom, viewport.top), viewportBottom);
	const roomBelow = Math.max(0, viewportBottom - PICKER_MARGIN - (anchorBottom + GAP));
	const roomAbove = Math.max(0, anchorTop - GAP - (viewport.top + PICKER_MARGIN));

	const fitsBelow = roomBelow >= wanted || roomBelow >= COMFORTABLE_HEIGHT;
	const side: 'below' | 'above' = fitsBelow || roomBelow >= roomAbove ? 'below' : 'above';
	const maxHeight = Math.max(0, Math.min(cap, side === 'below' ? roomBelow : roomAbove));
	const height = Math.min(wanted, maxHeight);
	const top = side === 'below' ? anchorBottom + GAP : anchorTop - GAP - height;
	return { top, left, width, maxHeight, side };
}
