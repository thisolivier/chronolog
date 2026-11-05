import { describe, it, expect } from 'vitest';
import { saveStatusDisplay } from './save-status-display';

describe('saveStatusDisplay', () => {
	it('reads "Saved" in green once everything is saved', () => {
		expect(saveStatusDisplay('saved', false)).toMatchObject({ label: 'Saved', tone: 'saved', dataStatus: 'saved' });
	});

	it('reads "Saving" in amber while saving and while a change waits, keeping data-status', () => {
		expect(saveStatusDisplay('saving', false)).toMatchObject({ label: 'Saving', tone: 'saving', dataStatus: 'saving' });
		expect(saveStatusDisplay('unsaved', false)).toMatchObject({ label: 'Saving', tone: 'saving', dataStatus: 'unsaved' });
	});

	it('shows a draft as "Draft" with data-status draft', () => {
		expect(saveStatusDisplay('saved', true)).toMatchObject({ label: 'Draft', tone: 'draft', dataStatus: 'draft' });
	});

	it('keeps failures distinct', () => {
		expect(saveStatusDisplay('error', false).tone).toBe('failed');
		expect(saveStatusDisplay('conflict', false)).toMatchObject({
			tone: 'failed',
			label: 'This note changed elsewhere, reload to see it'
		});
	});
});
