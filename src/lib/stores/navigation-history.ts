/**
 * A mirror of the browser history entries this tab visited inside Chronolog (sprint 027-CL).
 *
 * The browser does not let a page read its history, so the store records every navigation
 * (push, replace, Back/Forward by `delta`) here. The phone's "← Back" uses it to decide
 * between `history.back()` (the previous entry is in the app, and its label is known) and
 * going one level up (nothing in the app before this entry). The top bar's Back / Forward buttons
 * (sprint 050-UI) read `canGoBack` / `canGoForward` and the entries either side. Kept in
 * sessionStorage so a reload continues the same stack.
 */
export interface HistorySnapshot {
	entries: string[];
	index: number;
}

export type HistoryStep =
	| { kind: 'push'; path: string }
	| { kind: 'replace'; path: string }
	| { kind: 'pop'; path: string; delta: number };

const STORAGE_KEY = 'chronolog:in-app-history';
const MAX_ENTRIES = 200;

export class InAppHistory {
	entries: string[];
	index: number;
	/**
	 * Back / Forward moves asked for (`expectMove`) that have not landed yet (050-UI). SvelteKit
	 * reports only the last of several quick moves, so the buttons count from where they are going.
	 */
	pendingMoves = 0;

	constructor(snapshot: HistorySnapshot = { entries: [], index: -1 }) {
		this.entries = [...snapshot.entries];
		this.index = snapshot.index;
	}

	get current(): string | null {
		return this.entries[this.index] ?? null;
	}

	/** Where this tab is going: the current entry plus the moves still on their way */
	private get position(): number {
		return this.index + this.pendingMoves;
	}

	/** The in-app entry Back would return to, or null when Back would leave the app */
	get previous(): string | null {
		return this.position > 0 ? (this.entries[this.position - 1] ?? null) : null;
	}

	/** The in-app entry Forward would go to, or null when nothing is ahead */
	get next(): string | null {
		return this.position >= 0 && this.position < this.entries.length - 1 ? (this.entries[this.position + 1] ?? null) : null;
	}

	/** A Back (-1) or Forward (+1) the app has asked the browser for */
	expectMove(delta: number): void {
		this.pendingMoves += delta;
	}

	/** Back stays inside the app: only when an entry this tab visited in the app is behind */
	get canGoBack(): boolean {
		return this.previous !== null;
	}

	get canGoForward(): boolean {
		return this.next !== null;
	}

	/** Start over: this entry is the first one the app knows about */
	reset(path: string): void {
		this.entries = [path];
		this.index = 0;
		this.pendingMoves = 0;
	}

	apply(step: HistoryStep): void {
		if (step.kind !== 'pop') this.pendingMoves = 0;
		if (step.kind === 'push') {
			this.entries = [...this.entries.slice(0, this.index + 1), step.path];
			this.index = this.entries.length - 1;
			if (this.entries.length > MAX_ENTRIES) {
				this.entries = this.entries.slice(-MAX_ENTRIES);
				this.index = this.entries.length - 1;
			}
		} else if (step.kind === 'replace') {
			if (this.index < 0) return this.reset(step.path);
			this.entries[this.index] = step.path;
		} else {
			const target = this.landingIndex(step.path, step.delta);
			// Moved outside what we recorded (or the record is stale), e.g. Back past our first
			// entry onto an older in-app page we lost track of: start over from here
			if (target === null) return this.reset(step.path);
			const moved = target - this.index;
			this.index = target;
			// The moves that landed are no longer pending; a move the other way clears them
			const remaining = this.pendingMoves - moved;
			this.pendingMoves = Math.sign(remaining) === Math.sign(this.pendingMoves) ? remaining : 0;
		}
	}

	/**
	 * The entry a Back/Forward landed on. SvelteKit skips reporting moves overtaken by a newer one
	 * (quick repeated presses), so `delta` may be the last move only: try where the pending moves
	 * lead, then `delta`, then the nearest entry with that path (the delta's way first).
	 */
	private landingIndex(path: string, delta: number): number | null {
		const candidates = this.pendingMoves !== 0 ? [this.index + this.pendingMoves] : [];
		candidates.push(this.index + delta);
		const direction = Math.sign(delta) || 1;
		for (let distance = 1; distance < this.entries.length; distance++) {
			candidates.push(this.index + direction * distance, this.index - direction * distance);
		}
		candidates.push(this.index);
		return candidates.find((candidate) => this.entries[candidate] === path) ?? null;
	}

	snapshot(): HistorySnapshot {
		return { entries: [...this.entries], index: this.index };
	}

	/** Restore after a reload, if the saved stack still points at this URL */
	static restore(storage: Pick<Storage, 'getItem'> | null, currentPath: string): InAppHistory | null {
		try {
			const raw = storage?.getItem(STORAGE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as HistorySnapshot;
			if (!Array.isArray(parsed.entries) || typeof parsed.index !== 'number') return null;
			if (parsed.entries[parsed.index] !== currentPath) return null;
			return new InAppHistory(parsed);
		} catch {
			return null;
		}
	}

	save(storage: Pick<Storage, 'setItem'> | null): void {
		try {
			storage?.setItem(STORAGE_KEY, JSON.stringify(this.snapshot()));
		} catch {
			// Private mode or quota: Back still works, only its label falls back
		}
	}
}
