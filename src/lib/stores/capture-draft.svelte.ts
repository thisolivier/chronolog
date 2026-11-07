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
		measuredTimeText: '',
		endTime: '',
		startTime: '',
		date: ''
	};
}

function fieldsOf(record: CaptureDraftFields): CaptureDraftFields {
	return {
		contractId: record.contractId,
		deliverableId: record.deliverableId,
		workTypeId: record.workTypeId,
		description: record.description,
		timeText: record.timeText,
		measuredTimeText: record.measuredTimeText,
		endTime: record.endTime,
		startTime: record.startTime,
		date: record.date
	};
}

export class CaptureDraftStore {
	/** The capture the fields belong to; null when there is no unfinished capture */
	captureKey = $state<string | null>(null);
	fields = $state<CaptureDraftFields>(emptyFields());

	#userId = '';
	#storage: Storage | null = null;

	configure(userId: string, storage: Storage | null): void {
		if (userId === this.#userId && storage === this.#storage) return;
		this.#userId = userId;
		this.#storage = storage;
		this.captureKey = null;
		this.fields = emptyFields();
	}

	/**
	 * Start or resume the completion of a stopped capture. Fields already stored for the same
	 * capture win over `initial` (what the server or the running widget knew); any other stored
	 * record belongs to a capture that no longer exists and is replaced.
	 */
	open(captureKey: string, initial: CaptureDraftFields): void {
		if (this.captureKey === captureKey) return;
		const stored = readCaptureDraft(this.#storage, this.#userId);
		if (stored && stored.captureKey === captureKey) {
			this.fields = fieldsOf(stored);
		} else {
			this.fields = { ...initial };
		}
		this.captureKey = captureKey;
		this.persist();
	}

	/** Write the current fields (call after an edit) */
	persist(): void {
		if (!this.captureKey) return;
		const record: CaptureDraftRecord = { captureKey: this.captureKey, ...$state.snapshot(this.fields) };
		writeCaptureDraft(this.#storage, this.#userId, record);
	}

	/** Save or Discard resolved the capture (or none exists any more): forget its fields */
	clear(): void {
		this.captureKey = null;
		this.fields = emptyFields();
		clearCaptureDraft(this.#storage, this.#userId);
	}
}

export const captureDraft = new CaptureDraftStore();
