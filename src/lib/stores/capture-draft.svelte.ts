/**
 * The one unfinished capture's completion fields (sprint 053-DR; helpers in `capture-draft.ts`).
 *
 * TimerWidget opens it when its timer is stopped (`open`), TimerCompletionForm binds its fields
 * to `fields` and calls `persist()` as they change, and Save or Discard calls `clear()`. Because
 * the state lives here and in localStorage (per user), a remounted widget (phone level change,
 * /search, /settings, /notes/trash, crossing 768px, a reload) finds the same fields again.
 * The root layout calls `configure(userId, localStorage)` once the user is known.
 */
import {
	clearCaptureDraft,
	readCaptureDraft,
	writeCaptureDraft,
	type CaptureDraftFields,
	type CaptureDraftRecord
} from './capture-draft';

function emptyFields(): CaptureDraftFields {
	return {
		contractId: '',
		deliverableId: '',
		workTypeId: '',
		description: '',
		timeText: '',
		measuredTimeText: ''
	};
}

function fieldsOf(record: CaptureDraftFields): CaptureDraftFields {
	return {
		contractId: record.contractId,
		deliverableId: record.deliverableId,
		workTypeId: record.workTypeId,
		description: record.description,
		timeText: record.timeText,
		measuredTimeText: record.measuredTimeText
	};
}

export class CaptureDraftStore {
	/** The capture the fields belong to; null when there is no unfinished capture */
	captureKey = $state<string | null>(null);
	/** The interval the time text was measured from */
	intervalKey = $state<string | null>(null);
	fields = $state<CaptureDraftFields>(emptyFields());

	#userId = '';
	#storage: Storage | null = null;

	configure(userId: string, storage: Storage | null): void {
		if (userId === this.#userId && storage === this.#storage) return;
		this.#userId = userId;
		this.#storage = storage;
		this.captureKey = null;
		this.intervalKey = null;
		this.fields = emptyFields();
	}

	/**
	 * Start or resume the completion of a stopped capture. Fields already held (in memory, else in
	 * storage) for the same capture win over `initial` (what the server or the running widget
	 * knew), except the time text when the capture's interval has changed since it was measured:
	 * then the time comes from `initial`, so the form shows and saves the server's interval. Any
	 * other record belongs to a capture that no longer exists and is replaced.
	 */
	open(captureKey: string, intervalKey: string, initial: CaptureDraftFields): void {
		const held =
			this.captureKey === captureKey && this.intervalKey !== null
				? { intervalKey: this.intervalKey, fields: fieldsOf(this.fields) }
				: (() => {
						const stored = readCaptureDraft(this.#storage, this.#userId);
						return stored && stored.captureKey === captureKey
							? { intervalKey: stored.intervalKey, fields: fieldsOf(stored) }
							: null;
					})();
		if (held && held.intervalKey === intervalKey && this.captureKey === captureKey) return;
		if (!held) {
			this.fields = { ...initial };
		} else if (held.intervalKey === intervalKey) {
			this.fields = held.fields;
		} else {
			this.fields = { ...held.fields, timeText: initial.timeText, measuredTimeText: initial.measuredTimeText };
		}
		this.captureKey = captureKey;
		this.intervalKey = intervalKey;
		this.persist();
	}

	/** The contract chosen in the completion form for this capture, if any (memory, else storage) */
	contractFor(captureKey: string): string {
		if (this.captureKey === captureKey) return this.fields.contractId;
		const stored = readCaptureDraft(this.#storage, this.#userId);
		return stored && stored.captureKey === captureKey ? stored.contractId : '';
	}

	/** Write the current fields (call after an edit) */
	persist(): void {
		if (!this.captureKey || this.intervalKey === null) return;
		const record: CaptureDraftRecord = {
			captureKey: this.captureKey,
			intervalKey: this.intervalKey,
			...$state.snapshot(this.fields)
		};
		writeCaptureDraft(this.#storage, this.#userId, record);
	}

	/** Save or Discard resolved the capture (or none exists any more): forget its fields */
	clear(): void {
		this.captureKey = null;
		this.intervalKey = null;
		this.fields = emptyFields();
		clearCaptureDraft(this.#storage, this.#userId);
	}
}

export const captureDraft = new CaptureDraftStore();
