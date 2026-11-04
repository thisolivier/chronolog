import { describe, expect, it } from 'vitest';
import { projectNoteDetail, projectNoteSummaries, projectWeeks, noteDetailFromCreate } from './outbox-projection';
import { queueEntryCreate, queueEntryDelete, queueEntryUpdate, queueNoteCreate, queueNoteUpdate } from './outbox-queue';
import { resolveHeldItem } from './outbox-resolve';
import { cachedEntry, contractInfo, knownNotes, searchCachedNotes, titlesFromCache, weeksFromCache } from './offline-reads';
import { emptyOutboxState, type NoteUpdateItem } from './outbox-types';
import type { NoteDetail, NoteSummary, TimeEntryDisplay, WeekData } from '$lib/services/types';

const NOW = '2026-11-04T10:00:00.000Z';

function entry(id: string, date: string, minutes: number, description = 'work'): TimeEntryDisplay {
	return {
		id,
		startTime: null,
		endTime: null,
		durationMinutes: minutes,
		contractId: 'C',
		contractName: 'Build',
		clientName: 'Acme',
		clientShortCode: 'ACME',
		clientColorIndex: 0,
		deliverableName: null,
		workTypeName: null,
		description,
		date
	};
}

function week(entries: TimeEntryDisplay[]): WeekData {
	const dates = ['2026-11-02', '2026-11-03', '2026-11-04'];
	const days = dates.map((date) => {
		const dayEntries = entries.filter((candidate) => candidate.date === date);
		return { date, entries: dayEntries, totalMinutes: dayEntries.reduce((sum, item) => sum + item.durationMinutes, 0) };
	});
	return { weekStart: '2026-11-02', days, weeklyTotalMinutes: entries.reduce((sum, item) => sum + item.durationMinutes, 0), status: 'unsubmitted' };
}

describe('outbox projection', () => {
	it('lays queued entry creates, edits, moves and deletes over a week', () => {
		const state = emptyOutboxState();
		queueEntryCreate(state, { tempId: 'offline-00000000000000e1', input: { date: '2026-11-04', durationMinutes: 15, contractId: 'C' }, display: entry('x', '2026-11-04', 15, 'new'), now: NOW });
		queueEntryUpdate(state, { entryId: 'A', base: null, changes: { durationMinutes: 90 }, now: NOW });
		queueEntryUpdate(state, { entryId: 'B', base: null, changes: { date: '2026-11-04' }, now: NOW });
		queueEntryDelete(state, { entryId: 'C1', base: null, date: null, now: NOW });
		const [projected] = projectWeeks([week([entry('A', '2026-11-02', 30), entry('B', '2026-11-03', 60), entry('C1', '2026-11-03', 10)])], state.items);
		expect(projected.days[0].entries.map((item) => [item.id, item.durationMinutes])).toEqual([['A', 90]]);
		expect(projected.days[1].entries).toEqual([]);
		expect(projected.days[2].entries.map((item) => item.id)).toEqual(['B', 'offline-00000000000000e1']);
		expect(projected.weeklyTotalMinutes).toBe(90 + 60 + 15);
	});

	it('shows queued note text in the note and its list, and notes made offline on top', () => {
		const state = emptyOutboxState();
		queueNoteUpdate(state, { noteId: 'N.1', baseUpdatedAt: 't', base: null, changes: { content: 'edited', contentJson: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"edited"}]}]}' }, now: NOW });
		queueNoteCreate(state, { tempId: 'offline-00000000000000a1', contractId: 'C', fields: { content: 'fresh' }, now: NOW });
		queueNoteCreate(state, { tempId: 'offline-00000000000000a2', contractId: 'OTHER', fields: { content: 'elsewhere' }, now: NOW });
		const note = { id: 'N.1', title: null, content: 'old', contentJson: null, contractId: 'C', wordCount: 1, isPinned: false, createdAt: 'c', updatedAt: 't' } as NoteDetail;
		expect(projectNoteDetail(note, state.items)).toMatchObject({ content: 'edited', updatedAt: 't' });

		const pinned = { id: 'P', contractId: 'C', isPinned: true, createdAt: 'c', updatedAt: 'u', firstLine: 'pinned', secondLine: '' } as NoteSummary;
		const listed = { ...pinned, id: 'N.1', isPinned: false, firstLine: 'old' };
		const list = projectNoteSummaries([pinned, listed], state.items, (contractId) => contractId === 'C');
		expect(list.map((item) => [item.id, item.firstLine])).toEqual([
			['P', 'pinned'],
			['offline-00000000000000a1', 'fresh'],
			['N.1', 'edited']
		]);
		expect(noteDetailFromCreate(state.items[1] as never)).toMatchObject({ id: 'offline-00000000000000a1', updatedAt: NOW });
	});
});

describe('answers from the read cache', () => {
	const reads: [string, unknown][] = [
		['/api/time-entries/weekly?weeks=2026-11-02', { weeks: [week([entry('A', '2026-11-02', 30)])] }],
		['/api/contracts-by-client?includeArchived=true', { contracts: [{ id: 'C', name: 'Build', clientId: 'K', clientName: 'Acme', clientShortCode: 'ACME', clientColorIndex: 3 }] }],
		['/api/notes?contractId=C', { notes: [{ id: 'N.1', contractId: 'C', isPinned: false, createdAt: 'c', updatedAt: '2026-11-01', firstLine: 'Kickoff notes', secondLine: 'budget' }] }],
		['/api/notes/N.2', { note: { id: 'N.2', title: 'Retro', content: 'what went well', contentJson: null, contractId: 'C', updatedAt: '2026-11-03' } }]
	];

	it('assembles weeks from any cached week request and finds an entry', () => {
		expect(weeksFromCache(['2026-11-02'], reads)?.[0].weekStart).toBe('2026-11-02');
		expect(weeksFromCache(['2026-11-02', '2026-11-09'], reads)).toBeNull();
		expect(cachedEntry(reads, 'A')?.durationMinutes).toBe(30);
		expect(contractInfo(reads, 'C')).toMatchObject({ contractName: 'Build', clientName: 'Acme', clientColorIndex: 3 });
	});

	it('searches and titles the cached notes', () => {
		const notes = knownNotes(reads);
		expect(searchCachedNotes('budget', {}, notes, reads).map((result) => result.id)).toEqual(['N.1']);
		expect(searchCachedNotes('WENT', {}, notes, reads)[0]).toMatchObject({ id: 'N.2', clientName: 'Acme' });
		expect(searchCachedNotes('', { recent: true }, notes, reads).map((result) => result.id)).toEqual(['N.2', 'N.1']);
		expect(titlesFromCache(['N.2', 'missing'], notes, reads)).toEqual([{ id: 'N.2', displayTitle: 'Retro', contractId: 'C', clientId: 'K' }]);
	});
});

describe('resolving a held item', () => {
	function heldNoteUpdate() {
		const state = emptyOutboxState();
		const item = queueNoteUpdate(state, { noteId: 'N', baseUpdatedAt: 't1', base: { content: 'a' }, changes: { content: 'mine' }, now: NOW }) as NoteUpdateItem;
		item.status = 'held';
		item.hold = { reason: 'conflict', message: 'x', conflictFields: ['content'], server: { content: 'theirs', title: null, updatedAt: 't2' }, heldAt: NOW };
		return { state, item };
	}

	it('keep mine rebases the edit on the server copy and queues it again', () => {
		const { state, item } = heldNoteUpdate();
		resolveHeldItem(state, item.sequence, 'mine');
		expect(state.items[0]).toMatchObject({ status: 'pending', baseUpdatedAt: 't2', base: { content: 'theirs', title: '' }, changes: { content: 'mine' } });
		expect(state.items[0].hold).toBeUndefined();
	});

	it("keep the server's drops the edit", () => {
		const { state, item } = heldNoteUpdate();
		resolveHeldItem(state, item.sequence, 'server');
		expect(state.items).toEqual([]);
	});

	it('discarding a refused entry create drops the delete waiting on it; retry keeps it waiting (re-review c)', () => {
		const tempId = 'offline-00000000000000e9';
		const build = () => {
			const state = emptyOutboxState();
			queueEntryCreate(state, { tempId, input: { date: '2026-11-04', durationMinutes: 15, contractId: 'C' }, display: entry(tempId, '2026-11-04', 15), now: NOW });
			state.items[0].inFlight = true;
			queueEntryDelete(state, { entryId: tempId, base: null, date: null, now: NOW });
			state.items[0].inFlight = undefined;
			state.items[0].status = 'held';
			state.items[0].hold = { reason: 'refused', message: '403', heldAt: NOW };
			return state;
		};
		const discarded = build();
		resolveHeldItem(discarded, discarded.items[0].sequence, 'server');
		expect(discarded.items).toEqual([]);
		const retried = build();
		resolveHeldItem(retried, retried.items[0].sequence, 'retry');
		expect(retried.items.map((item) => [item.kind, item.status])).toEqual([['entry-create', 'pending'], ['entry-delete', 'pending']]);
	});

	it('a queued create the server already has shows once, with the queued values', () => {
		const tempId = 'offline-00000000000000ea';
		const state = emptyOutboxState();
		queueEntryCreate(state, { tempId, input: { date: '2026-11-04', durationMinutes: 50, contractId: 'C' }, display: { ...entry(tempId, '2026-11-04', 50, 'queued text') }, now: NOW });
		const serverRow = { ...entry('real-1', '2026-11-04', 20, 'first attempt'), clientRequestId: tempId };
		const [projected] = projectWeeks([week([serverRow])], state.items);
		expect(projected.days[2].entries).toHaveLength(1);
		expect(projected.days[2].entries[0]).toMatchObject({ id: 'real-1', durationMinutes: 50, description: 'queued text' });
	});
});
