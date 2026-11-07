/**
 * The unfinished capture's completion fields, persisted per user (design r1 IN-03 / TC-06 /
 * SH-07, sprint 053-DR). Pure helpers: the reactive store is `capture-draft.svelte.ts`.
 *
 * A stopped timer that is not yet saved or discarded is one unfinished capture. Its frozen end
 * already lives on the server row (or the browser's pending timer); this record keeps what the
 * user has typed or chosen in the completion form, so collapse, phone Back, /search, /settings
 * and crossing the 768px breakpoint never lose it. It is not a queue and not a second timer
 * model: one record, keyed to the capture it belongs to, cleared by Save or Discard.
 */

export interface CaptureDraftFields {
	contractId: string;
	deliverableId: string;
	workTypeId: string;
	description: string;
	/** What the Time field shows (duration or range text) */
	timeText: string;
	/** The measured text the form started from: an untouched field sends no adjusted time */
	measuredTimeText: string;
	/** The frozen end (`HH:MM:SS`), start and date of the capture */
	endTime: string;
	startTime: string;
	date: string;
}

export interface CaptureDraftRecord extends CaptureDraftFields {
	/** Which capture these fields belong to (`captureKeyFor`) */
	captureKey: string;
}

export const CAPTURE_DRAFT_KEY_PREFIX = 'chronolog:capture-draft:';

export function captureDraftStorageKey(userId: string): string {
	return `${CAPTURE_DRAFT_KEY_PREFIX}${userId}`;
}

/** A server draft is keyed by its id; a browser-only timer by its start */
export function captureKeyFor(capture: { entryId: string; date: string; startTime: string }): string {
	return capture.entryId ? `entry:${capture.entryId}` : `pending:${capture.date}T${capture.startTime}`;
}

const FIELD_NAMES: (keyof CaptureDraftRecord)[] = [
	'captureKey',
	'contractId',
	'deliverableId',
	'workTypeId',
	'description',
	'timeText',
	'measuredTimeText',
	'endTime',
	'startTime',
	'date'
];

function isCaptureDraftRecord(value: unknown): value is CaptureDraftRecord {
	if (!value || typeof value !== 'object') return false;
	const record = value as Record<string, unknown>;
	return FIELD_NAMES.every((name) => typeof record[name] === 'string') && record.captureKey !== '';
}

export function readCaptureDraft(storage: Storage | null, userId: string): CaptureDraftRecord | null {
	if (!storage || !userId) return null;
	try {
		const raw = storage.getItem(captureDraftStorageKey(userId));
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		return isCaptureDraftRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export function writeCaptureDraft(storage: Storage | null, userId: string, record: CaptureDraftRecord): void {
	if (!storage || !userId) return;
	try {
		const stored = Object.fromEntries(FIELD_NAMES.map((name) => [name, record[name]]));
		storage.setItem(captureDraftStorageKey(userId), JSON.stringify(stored));
	} catch {
		// Storage full or blocked: the form still works for this page's lifetime
	}
}

export function clearCaptureDraft(storage: Storage | null, userId: string): void {
	if (!storage || !userId) return;
	try {
		storage.removeItem(captureDraftStorageKey(userId));
	} catch {
		// Nothing to clear
	}
}
