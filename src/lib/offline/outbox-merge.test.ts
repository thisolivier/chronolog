import { describe, expect, it } from 'vitest';
import { planEntryDelete, planEntryUpdate, planNoteUpdate } from './outbox-merge';

const server = { title: 'Server title', content: 'server body', contentJson: '{"s":1}', updatedAt: 't2' };

describe('per-field last-write-wins for notes', () => {
	it('sends everything when the server copy is the one the edit was based on', () => {
		const plan = planNoteUpdate({ baseUpdatedAt: 't2', base: null, changes: { content: 'mine', contentJson: '{}' } }, server);
		expect(plan).toEqual({ action: 'send', body: { content: 'mine', contentJson: '{}', expectedUpdatedAt: 't2' } });
	});

	it('keeps my field when the server changed only another field', () => {
		const plan = planNoteUpdate(
			{ baseUpdatedAt: 't1', base: { content: 'server body', title: 'Old' }, changes: { content: 'mine', contentJson: '{}' } },
			server
		);
		expect(plan).toEqual({ action: 'send', body: { content: 'mine', contentJson: '{}', expectedUpdatedAt: 't2' } });
	});

	it('holds when the server changed the same field', () => {
		const plan = planNoteUpdate({ baseUpdatedAt: 't1', base: { content: 'original' }, changes: { content: 'mine' } }, server);
		expect(plan).toEqual({ action: 'hold', conflictFields: ['content'] });
	});

	it('holds when the base of a changed field is unknown and the server moved on', () => {
		const plan = planNoteUpdate({ baseUpdatedAt: 't1', base: null, changes: { title: 'Mine' } }, server);
		expect(plan).toEqual({ action: 'hold', conflictFields: ['title'] });
	});

	it('sends nothing when the server already has my value', () => {
		const plan = planNoteUpdate({ baseUpdatedAt: 't1', base: null, changes: { title: 'Server title' } }, server);
		expect(plan).toEqual({ action: 'nothing-to-send' });
	});
});

describe('per-field last-write-wins for time entries', () => {
	const serverEntry = {
		contractId: 'C',
		deliverableId: null,
		workTypeId: null,
		date: '2026-11-04',
		startTime: '09:00:00',
		endTime: '10:00:00',
		durationMinutes: 60,
		description: 'changed on server'
	};

	it('sends my time when the server changed only the description', () => {
		const plan = planEntryUpdate(
			{
				base: { startTime: '09:00', endTime: '10:00', durationMinutes: 60, description: 'old' },
				changes: { startTime: '09:00', endTime: '11:00', durationMinutes: 120 }
			},
			serverEntry
		);
		expect(plan).toEqual({ action: 'send', body: { startTime: '09:00', endTime: '11:00', durationMinutes: 120 } });
	});

	it('holds when both sides changed the description', () => {
		const plan = planEntryUpdate({ base: { description: 'old' }, changes: { description: 'mine' } }, serverEntry);
		expect(plan).toEqual({ action: 'hold', conflictFields: ['description'] });
	});

	it('deletes an unchanged entry, holds an edited one, and skips one already gone', () => {
		expect(planEntryDelete({ base: { description: 'changed on server', durationMinutes: 60 } }, serverEntry)).toEqual({
			action: 'send',
			body: null
		});
		expect(planEntryDelete({ base: { description: 'old' } }, serverEntry)).toEqual({ action: 'hold', conflictFields: ['description'] });
		expect(planEntryDelete({ base: null }, null)).toEqual({ action: 'nothing-to-send' });
	});
});
