/**
 * A mirror of the browser history entries this tab visited inside Chronolog (sprint 027-CL).
 *
 * The browser does not let a page read its history, so the store records every navigation
 * (push, replace, Back/Forward by `delta`) here. The phone's "← Back" uses it to decide
 * between `history.back()` (the previous entry is in the app, and its label is known) and
 * going one level up (nothing in the app before this entry). Kept in sessionStorage so a
 * reload continues the same stack.
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

	constructor(snapshot: HistorySnapshot = { entries: [], index: -1 }) {
		this.entries = [...snapshot.entries];
		this.index = snapshot.index;
	}

	get current(): string | null {
		return this.entries[this.index] ?? null;
	}

	/** The in-app entry Back would return to, or null when Back would leave the app */
	get previous(): string | null {
		return this.index > 0 ? (this.entries[this.index - 1] ?? null) : null;
	}

	/** Start over: this entry is the first one the app knows about */
	reset(path: string): void {
		this.entries = [path];
		this.index = 0;
	}

	apply(step: HistoryStep): void {
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
			const target = this.index + step.delta;
			// Moved outside what we recorded (or the record is stale): start over from here
			if (target < 0 || target >= this.entries.length || this.entries[target] !== step.path) {
				// Back past our first entry onto an older in-app page we lost track of
				return this.reset(step.path);
			}
			this.index = target;
		}
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
