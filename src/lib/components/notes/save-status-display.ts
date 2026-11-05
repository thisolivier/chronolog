import type { SaveStatus } from './note-autosave';

/**
 * What the editor header's save pill shows (sprint 051-UI): "Saved" (green) or "Saving" (amber,
 * also while a change waits for its debounce), "Draft" for an unsaved new note, all in one fixed
 * width so typing never shifts the header line. Failures stay distinct (red, their own width).
 */
export type SaveStatusTone = 'saved' | 'saving' | 'draft' | 'failed';

export interface SaveStatusDisplay {
	/** `data-status`: the autosave status, or `draft` (tests rely on these values) */
	dataStatus: SaveStatus | 'draft';
	label: string;
	/** Longer wording for the tooltip */
	title: string;
	tone: SaveStatusTone;
}

export function saveStatusDisplay(status: SaveStatus, isDraft: boolean): SaveStatusDisplay {
	if (isDraft && status === 'saved') {
		return { dataStatus: 'draft', label: 'Draft', title: 'Not saved until you type', tone: 'draft' };
	}
	switch (status) {
		case 'saved':
			return { dataStatus: status, label: 'Saved', title: 'All changes saved', tone: 'saved' };
		case 'saving':
		case 'unsaved':
			return { dataStatus: status, label: 'Saving', title: 'Saving your changes', tone: 'saving' };
		case 'error':
			return { dataStatus: status, label: "Couldn't save — retrying", title: "Couldn't save — retrying", tone: 'failed' };
		case 'conflict':
			return {
				dataStatus: status,
				label: 'This note changed elsewhere, reload to see it',
				title: 'This note changed elsewhere, reload to see it',
				tone: 'failed'
			};
	}
}
