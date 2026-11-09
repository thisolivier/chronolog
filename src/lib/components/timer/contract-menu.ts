/**
 * Pure rules for the timer's contract menu (sprint 064-DR, T4): which item a key moves to, and
 * where the menu goes on screen. The menu is `position: fixed`, so the sidebar's `overflow: hidden`
 * and the phone capture screen never clip it. It drops down from its trigger (scrolling when the
 * list is long) and flips above only when there is not room below for a few rows and there is
 * more room above. It is kept inside the viewport with a margin.
 */

/** The item index a key moves focus to, or null when the key is not a movement key */
export function nextMenuItemIndex(key: string, currentIndex: number, itemCount: number): number | null {
	if (itemCount === 0) return null;
	switch (key) {
		case 'ArrowDown':
			return currentIndex < 0 ? 0 : (currentIndex + 1) % itemCount;
		case 'ArrowUp':
			return currentIndex < 0 ? itemCount - 1 : (currentIndex - 1 + itemCount) % itemCount;
		case 'Home':
			return 0;
		case 'End':
			return itemCount - 1;
		default:
			return null;
	}
}

export type MenuAnchor = { left: number; top: number; bottom: number };
export type MenuViewport = { width: number; height: number };
export type MenuPlacement = {
	left: number;
	width: number;
	maxHeight: number;
	/** Distance from the viewport top when the menu opens below the trigger */
	top: number | null;
	/** Distance from the viewport bottom when it opens above */
	bottom: number | null;
};

export const MENU_EDGE_MARGIN = 8;
export const MENU_TRIGGER_GAP = 4;
/** Below the trigger is good enough when this much fits (about three 44 px rows) */
export const MENU_MINIMUM_HEIGHT_BELOW = 140;

/**
 * Place the menu for a trigger box. `preferredWidth` and `contentHeight` are what the menu would
 * like; it is narrowed to the viewport and given the room on the side it opens on.
 */
export function placeContractMenu(
	anchor: MenuAnchor,
	viewport: MenuViewport,
	preferredWidth: number,
	contentHeight: number
): MenuPlacement {
	const width = Math.max(0, Math.min(preferredWidth, viewport.width - 2 * MENU_EDGE_MARGIN));
	const rightmostLeft = viewport.width - MENU_EDGE_MARGIN - width;
	const left = Math.max(MENU_EDGE_MARGIN, Math.min(anchor.left, rightmostLeft));
	const roomBelow = viewport.height - anchor.bottom - MENU_TRIGGER_GAP - MENU_EDGE_MARGIN;
	const roomAbove = anchor.top - MENU_TRIGGER_GAP - MENU_EDGE_MARGIN;
	const opensBelow = roomBelow >= Math.min(contentHeight, MENU_MINIMUM_HEIGHT_BELOW) || roomBelow >= roomAbove;
	return opensBelow
		? { left, width, maxHeight: Math.max(0, roomBelow), top: anchor.bottom + MENU_TRIGGER_GAP, bottom: null }
		: { left, width, maxHeight: Math.max(0, roomAbove), top: null, bottom: viewport.height - anchor.top + MENU_TRIGGER_GAP };
}
