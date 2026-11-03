/**
 * Debounced autosave that never drops the last edit.
 *
 * - `markDirty()` after every change; a save runs `delayMs` after the last one.
 * - `flush()` saves immediately (note switch, destroy, `visibilitychange`, layout change).
 *   The snapshot is captured synchronously, so calling it right before the editor is
 *   destroyed is safe.
 * - `flush({ keepalive: true })` is for `pagehide` / `beforeunload`: the request is started
 *   in the same task so the browser keeps it alive while the page unloads.
 * - Saves run one at a time, in order. A failed save keeps its snapshot and retries.
 *
 * Module-level `trackNoteSave` / `waitForNoteSaves` let a remounted panel wait for an
 * in-flight save of a note before loading it, so it never shows (and later overwrites
 * with) stale content.
 */

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict';

export type PersistOptions = { keepalive: boolean };

export interface AutosaveControllerOptions<Snapshot> {
	capture: () => Snapshot;
	persist: (snapshot: Snapshot, options: PersistOptions) => Promise<void>;
	onStatusChange?: (status: SaveStatus) => void;
	delayMs?: number;
	retryDelayMs?: number;
	/** Retries attempted after `dispose()` before giving up */
	maxRetriesAfterDispose?: number;
	/**
	 * True for a failure that must not be retried because the server copy changed
	 * elsewhere: autosave stops (status `conflict`) instead of overwriting it.
	 */
	isConflict?: (error: unknown) => boolean;
}

export class AutosaveController<Snapshot> {
	private readonly options: Required<Omit<AutosaveControllerOptions<Snapshot>, 'onStatusChange' | 'isConflict'>> &
		Pick<AutosaveControllerOptions<Snapshot>, 'onStatusChange' | 'isConflict'>;
	private halted = false;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private retryTimer: ReturnType<typeof setTimeout> | null = null;
	private isDirty = false;
	private failedSnapshot: Snapshot | null = null;
	private savesInFlight = 0;
	private queue: Promise<void> = Promise.resolve();
	private disposed = false;
	private retriesAfterDispose = 0;
	private currentStatus: SaveStatus = 'saved';

	constructor(options: AutosaveControllerOptions<Snapshot>) {
		this.options = {
			delayMs: 500,
			retryDelayMs: 5000,
			maxRetriesAfterDispose: 3,
			...options
		};
	}

	get status(): SaveStatus {
		return this.currentStatus;
	}

	/** True while anything typed has not been confirmed saved by the server. */
	get hasUnsavedChanges(): boolean {
		if (this.halted) return false;
		return this.isDirty || this.failedSnapshot !== null || this.savesInFlight > 0;
	}

	markDirty(): void {
		if (this.disposed || this.halted) return;
		this.isDirty = true;
		this.failedSnapshot = null; // the next capture supersedes it
		this.setStatus('unsaved');
		this.clearTimer('debounce');
		this.debounceTimer = setTimeout(() => void this.flush(), this.options.delayMs);
	}

	/** Save now if there is anything pending. Resolves when that save settles. */
	flush(flushOptions: Partial<PersistOptions> = {}): Promise<void> {
		this.clearTimer('debounce');
		this.clearTimer('retry');
		if (this.halted) return this.queue;

		let snapshot: Snapshot | null = null;
		if (this.isDirty && !this.disposed) {
			snapshot = this.options.capture();
		} else if (this.isDirty || this.failedSnapshot !== null) {
			// After dispose the editor is gone: retry the last failed snapshot, or capture
			// one last time if the caller flushed during dispose (handled in dispose()).
			snapshot = this.failedSnapshot;
		}
		this.isDirty = false;
		this.failedSnapshot = null;
		if (snapshot === null) return this.queue;

		const keepalive = flushOptions.keepalive ?? false;
		const pendingSnapshot = snapshot;
		this.savesInFlight += 1;
		this.setStatus('saving');

		const run = () =>
			this.options.persist(pendingSnapshot, { keepalive }).then(
				() => this.onSaveSettled(null),
				(error: unknown) => {
					if (this.options.isConflict?.(error)) {
						this.halt();
						return;
					}
					console.error('Autosave failed:', error);
					this.onSaveSettled(pendingSnapshot);
				}
			);

		// Unload: start the request synchronously unless an earlier save is still running.
		if (keepalive && this.savesInFlight === 1) {
			this.queue = run();
		} else {
			this.queue = this.queue.then(run);
		}
		return this.queue;
	}

	/** Final flush (component destroy). Pending text is captured now, before teardown. */
	dispose(flushOptions: Partial<PersistOptions> = {}): Promise<void> {
		if (this.isDirty && !this.disposed) {
			this.failedSnapshot = this.options.capture();
			this.isDirty = false;
		}
		this.disposed = true;
		return this.flush(flushOptions);
	}

	/** Stop saving for good: the note changed elsewhere and must be reloaded. */
	private halt(): void {
		this.savesInFlight -= 1;
		this.halted = true;
		this.isDirty = false;
		this.failedSnapshot = null;
		this.clearTimer('debounce');
		this.clearTimer('retry');
		this.setStatus('conflict');
	}

	private onSaveSettled(failedSnapshot: Snapshot | null): void {
		this.savesInFlight -= 1;
		if (failedSnapshot !== null) {
			// Keep the failed text unless newer edits already replaced it
			if (!this.isDirty) this.failedSnapshot = failedSnapshot;
			this.setStatus('error');
			this.scheduleRetry();
			return;
		}
		if (this.isDirty) {
			this.setStatus('unsaved');
		} else if (this.savesInFlight === 0 && this.failedSnapshot === null) {
			this.setStatus('saved');
		}
	}

	private scheduleRetry(): void {
		if (this.disposed) {
			if (this.retriesAfterDispose >= this.options.maxRetriesAfterDispose) return;
			this.retriesAfterDispose += 1;
		}
		this.clearTimer('retry');
		this.retryTimer = setTimeout(() => {
			if (this.failedSnapshot !== null && !this.isDirty) {
				if (!this.disposed) {
					// Retry with the current editor content, which includes the failed text
					this.isDirty = true;
					this.failedSnapshot = null;
				}
				void this.flush();
			}
		}, this.options.retryDelayMs);
	}

	private clearTimer(which: 'debounce' | 'retry'): void {
		if (which === 'debounce' && this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		if (which === 'retry' && this.retryTimer) {
			clearTimeout(this.retryTimer);
			this.retryTimer = null;
		}
	}

	private setStatus(status: SaveStatus): void {
		if (status === this.currentStatus) return;
		this.currentStatus = status;
		this.options.onStatusChange?.(status);
	}
}

// -- In-flight saves per note (survives component remounts) --

const savesByNoteId = new Map<string, Promise<unknown>>();

/** Register a save of `noteId`; `waitForNoteSaves` resolves after it settles. */
export function trackNoteSave<Result>(noteId: string, save: Promise<Result>): Promise<Result> {
	const previous = savesByNoteId.get(noteId) ?? Promise.resolve();
	const combined = Promise.allSettled([previous, save]);
	savesByNoteId.set(noteId, combined);
	void combined.then(() => {
		if (savesByNoteId.get(noteId) === combined) savesByNoteId.delete(noteId);
	});
	return save;
}

/** Resolves once every tracked save of `noteId` has settled (immediately if none). */
export async function waitForNoteSaves(noteId: string): Promise<void> {
	let pending = savesByNoteId.get(noteId);
	while (pending) {
		await pending;
		const next = savesByNoteId.get(noteId);
		pending = next === pending ? undefined : next;
	}
}
