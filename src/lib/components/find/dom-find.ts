/**
 * Find in a rendered panel (the timesheet week, sprint 042-CL). Matches are DOM Ranges over the
 * panel's visible text nodes; they are painted with the CSS Custom Highlight API, which never
 * touches the DOM (no wrapping `<mark>`s for Svelte to trip over). Where the API is missing the
 * count and next/previous still work: the current match is scrolled into view.
 */
import { findMatchRanges } from '$lib/utils/search-snippet';

export const MATCH_HIGHLIGHT = 'chronolog-find';
export const CURRENT_HIGHLIGHT = 'chronolog-find-current';
/** Elements whose text is never searched (the find bar marks itself with this attribute) */
export const FIND_EXCLUDED_ATTRIBUTE = 'data-find-exclude';

type HighlightRegistry = { set: (name: string, highlight: unknown) => void; delete: (name: string) => void };
type HighlightConstructor = new (...ranges: Range[]) => unknown;

function highlightApi(): { registry: HighlightRegistry; Highlight: HighlightConstructor } | null {
	const cssNamespace = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS;
	const Highlight = (globalThis as { Highlight?: HighlightConstructor }).Highlight;
	return cssNamespace?.highlights && Highlight ? { registry: cssNamespace.highlights, Highlight } : null;
}

function isSearchableTextNode(node: Node): boolean {
	const parent = node.parentElement;
	if (!parent || !node.nodeValue?.trim()) return false;
	if (parent.closest(`[${FIND_EXCLUDED_ATTRIBUTE}], script, style, textarea, input, select, [aria-hidden="true"]`)) return false;
	// Hidden text (display: none ancestors) has no client rects
	return parent.getClientRects().length > 0;
}

/** Every case-insensitive match of `query` in the visible text under `root`, in document order. */
export function findRangesIn(root: Element, query: string): Range[] {
	if (!query) return [];
	const document = root.ownerDocument;
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const ranges: Range[] = [];
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (!isSearchableTextNode(node)) continue;
		for (const match of findMatchRanges(node.nodeValue ?? '', query)) {
			const range = document.createRange();
			range.setStart(node, match.start);
			range.setEnd(node, match.end);
			ranges.push(range);
		}
	}
	return ranges;
}

/** Paint all matches, and the current one on top; scroll the current one into view. */
export function paintRanges(ranges: Range[], currentIndex: number, options: { scroll: boolean }): void {
	const api = highlightApi();
	const current = ranges[currentIndex];
	if (api) {
		api.registry.set(MATCH_HIGHLIGHT, new api.Highlight(...ranges));
		if (current) api.registry.set(CURRENT_HIGHLIGHT, new api.Highlight(current));
		else api.registry.delete(CURRENT_HIGHLIGHT);
	}
	if (options.scroll && current) {
		const element = current.startContainer.parentElement;
		element?.scrollIntoView?.({ block: 'center' });
	}
}

export function clearPaintedRanges(): void {
	const api = highlightApi();
	api?.registry.delete(MATCH_HIGHLIGHT);
	api?.registry.delete(CURRENT_HIGHLIGHT);
}

const STYLE_ELEMENT_ID = 'chronolog-find-styles';

/** Highlight colours for both modes, added to the document once. */
export function installFindStyles(): void {
	if (typeof document === 'undefined' || document.getElementById(STYLE_ELEMENT_ID)) return;
	const style = document.createElement('style');
	style.id = STYLE_ELEMENT_ID;
	style.textContent = `
::highlight(${MATCH_HIGHLIGHT}) { background-color: var(--color-ochre-200); color: inherit; }
::highlight(${CURRENT_HIGHLIGHT}) { background-color: var(--color-ochre-300); color: var(--color-ink); }
.chronolog-find-match { background-color: var(--color-ochre-200); border-radius: 2px; }
.chronolog-find-current { background-color: var(--color-ochre-300); color: var(--color-ink); }
`;
	document.head.appendChild(style);
}
