/**
 * Note position memory (design r1 SH-07 / NT-07, sprint 054-DR): where a note was scrolled to,
 * and its caret, so Back / Forward to that note (and the phone's return from capture, which is a
 * Back) puts the reader where they left off. Follows the timesheet's per-week scroll memory
 * (sprint 027-CL): positions live in sessionStorage, so they last for the tab and survive a reload.
 *
 * Restoring happens only on a history return to the same note (a popstate navigation). A fresh
 * open from the list, a wiki-link or search starts at the top as before. A URL correction made
 * right after a Back (the same note under its own contract) does not cancel the return.
 *
 * The pure parts (storage, the history-return rule) are unit tested in note-scroll-memory.test.ts;
 * `attachNoteScrollMemory` wires them to the editor's DOM.
 */
import { parseWorkspacePath } from '$lib/stores/navigation-routes';

export const NOTE_POSITIONS_KEY = 'chronolog:note-positions';
/** Notes remembered per tab; the oldest is dropped beyond this */
export const MAX_REMEMBERED_NOTES = 50;
/** Frames to wait for the note's layout (images, code highlighting) before giving up */
const RESTORE_FRAME_LIMIT = 30;

export interface NotePosition {
	scrollTop: number;
	selectionFrom: number | null;
	selectionTo: number | null;
}

type StoredPositions = Array<[noteId: string, position: NotePosition]>;

function readAll(storage: Storage | null): StoredPositions {
	if (!storage) return [];
	try {
		const parsed = JSON.parse(storage.getItem(NOTE_POSITIONS_KEY) ?? '[]');
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

/** Remember a note's position; the most recent note goes last and the oldest beyond the cap go */
export function rememberNotePosition(storage: Storage | null, noteId: string, position: NotePosition): void {
	if (!storage) return;
	const entries = readAll(storage).filter(([storedId]) => storedId !== noteId);
	entries.push([noteId, position]);
	try {
		storage.setItem(NOTE_POSITIONS_KEY, JSON.stringify(entries.slice(-MAX_REMEMBERED_NOTES)));
	} catch {
		// Storage full or blocked: positions are a convenience
	}
}

export function readNotePosition(storage: Storage | null, noteId: string): NotePosition | null {
	return readAll(storage).find(([storedId]) => storedId === noteId)?.[1] ?? null;
}

/** The note a workspace path shows, or null */
export function noteIdOfWorkspacePath(path: string): string | null {
	const route = parseWorkspacePath(path, '');
	return route && route.kind !== 'home' && route.kind !== 'time' ? route.noteId : null;
}

/**
 * Tracks the last navigation that changed which note is shown. A replace correction of the same
 * note (kind `goto`) keeps the earlier `popstate`, so the return is still recognised.
 */
export function createHistoryReturnTracker() {
	let lastKind: string | null = null;
	let lastNoteId: string | null = null;
	return {
		record(kind: string, path: string) {
			const noteId = noteIdOfWorkspacePath(path);
			if (kind !== 'popstate' && noteId !== null && noteId === lastNoteId) return;
			lastKind = kind;
			lastNoteId = noteId;
		},
		/** The note was reached through Back / Forward */
		isHistoryReturnTo(noteId: string): boolean {
			return lastKind === 'popstate' && lastNoteId === noteId;
		}
	};
}

/** One tracker per page, fed by the root layout's afterNavigate */
export const historyReturns = createHistoryReturnTracker();

/** Clamp a remembered selection to the document as it is now */
export function clampSelection(position: NotePosition, documentSize: number): { from: number; to: number } | null {
	if (position.selectionFrom === null || position.selectionTo === null) return null;
	const limit = Math.max(1, documentSize - 1);
	return { from: Math.min(Math.max(1, position.selectionFrom), limit), to: Math.min(Math.max(1, position.selectionTo), limit) };
}

function sessionStore(): Storage | null {
	try {
		return typeof window === 'undefined' ? null : window.sessionStorage;
	} catch {
		return null;
	}
}

/** The nearest ancestor that actually scrolls vertically */
export function findScrollContainer(element: HTMLElement): HTMLElement | null {
	for (let current = element.parentElement; current; current = current.parentElement) {
		const overflowY = getComputedStyle(current).overflowY;
		if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight + 1) return current;
	}
	return null;
}

export interface NoteScrollMemoryOptions {
	/** The editor's content element (inside the note's scroller) */
	element: HTMLElement;
	getNoteId: () => string | null;
	getSelection: () => { from: number; to: number } | null;
	setSelection: (selection: { from: number; to: number }) => void;
	getDocumentSize: () => number;
	storage?: Storage | null;
}

/**
 * Record the note's position as it scrolls or the caret moves, and restore it once when the
 * note was reached through history. Returns the teardown.
 */
export function attachNoteScrollMemory(options: NoteScrollMemoryOptions): { remember: () => void; destroy: () => void } {
	const storage = options.storage === undefined ? sessionStore() : options.storage;
	let isRestoring = false;
	let isDestroyed = false;
	let frame = 0;

	function remember(scrollTop = findScrollContainer(options.element)?.scrollTop ?? 0) {
		const noteId = options.getNoteId();
		if (!noteId || isRestoring || isDestroyed || !options.element.isConnected) return;
		const selection = options.getSelection();
		rememberNotePosition(storage, noteId, {
			scrollTop,
			selectionFrom: selection?.from ?? null,
			selectionTo: selection?.to ?? null
		});
	}

	function handleScroll(event: Event) {
		const target = event.target;
		if (!(target instanceof HTMLElement) || !target.contains(options.element)) return;
		if (target !== findScrollContainer(options.element)) return;
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => remember(target.scrollTop));
	}

	function restore(position: NotePosition) {
		const selection = clampSelection(position, options.getDocumentSize());
		if (selection) options.setSelection(selection);
		if (position.scrollTop <= 0) return;
		isRestoring = true;
		let framesLeft = RESTORE_FRAME_LIMIT;
		const step = () => {
			if (isDestroyed) return;
			const scroller = findScrollContainer(options.element);
			const reachable = scroller ? scroller.scrollHeight - scroller.clientHeight : 0;
			if (scroller && (reachable >= position.scrollTop || framesLeft <= 0)) {
				scroller.scrollTop = position.scrollTop;
				// Let the scroll event this causes pass before recording again
				requestAnimationFrame(() => (isRestoring = false));
				return;
			}
			if (framesLeft-- <= 0) {
				isRestoring = false;
				return;
			}
			requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}

	const noteId = options.getNoteId();
	const saved = noteId && historyReturns.isHistoryReturnTo(noteId) ? readNotePosition(storage, noteId) : null;
	if (saved) restore(saved);

	document.addEventListener('scroll', handleScroll, true);
	return {
		remember: () => remember(),
		destroy() {
			isDestroyed = true;
			cancelAnimationFrame(frame);
			document.removeEventListener('scroll', handleScroll, true);
		}
	};
}
