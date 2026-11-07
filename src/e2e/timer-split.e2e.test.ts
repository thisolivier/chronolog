/**
 * E2E (sprint 056-DR): `POST /api/timer/split`, resume through `PATCH /api/timer`, the draft-only
 * guard on `POST /api/timer/save` / `discard`, and note links made by a timer save.
 * Times are the test machine's local clock, like the browser's.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import './test-init';
import { authGet, authPatch, authPost } from './helpers';

const pad = (value: number) => String(value).padStart(2, '0');
/** Local `{ date, time, text }` for `minutesAgo` minutes before now, on the whole minute. */
function minutesAgo(minutes: number) {
	const moment = new Date(Date.now() - minutes * 60_000);
	const date = `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;
	const time = `${pad(moment.getHours())}:${pad(moment.getMinutes())}:00`;
	return { date, time, text: `${date}T${time}` };
}

let contractId = '';
let noteId = '';
const runTag = Date.now().toString(36);

async function clearDraft() {
	const { timer } = await (await authGet('/api/timer/status')).json();
	if (timer) expect((await authPost('/api/timer/discard', { entryId: timer.id })).status).toBe(200);
}

async function startTimer(startedMinutesAgo: number) {
	const start = minutesAgo(startedMinutesAgo);
	const response = await authPost('/api/timer/start', { contractId, date: start.date, startTime: start.time, confirmed: true });
	expect(response.status).toBe(201);
	return { id: (await response.json()).id as string, start };
}

async function linkedEntryIds(): Promise<string[]> {
	const { timeEntries } = await (await authGet(`/api/notes/${noteId}/time-entries`)).json();
	return timeEntries.map((link: { timeEntryId: string }) => link.timeEntryId);
}

beforeAll(async () => {
	const contracts = await (await authGet('/api/contracts')).json();
	contractId = contracts.find((contract: { name: string }) => contract.name === 'General').id;
	const created = await authPost('/api/notes', { contractId });
	noteId = (await created.json()).note.id;
});

beforeEach(clearDraft);

describe('POST /api/timer/split', () => {
	it('saves the left part with its links and advances the running draft; a retry settles once', async () => {
		const { id, start } = await startTimer(90);
		const boundary = minutesAgo(60);
		const body = {
			entryId: id,
			expectedStartedAt: start.text,
			boundary: boundary.text,
			clientRequestId: `split-save-${runTag}`,
			left: { action: 'save', contractId, description: `Left ${runTag} [[${noteId}]]` },
			right: { contractId, description: 'Right part' }
		};
		const response = await authPost('/api/timer/split', body);
		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result.replayed).toBe(false);
		expect(result.left.action).toBe('saved');
		expect(result.left.entry).toMatchObject({ isDraft: false, date: start.date, startTime: start.time, endTime: boundary.time, durationMinutes: 30 });
		expect(result.remainder.kind).toBe('draft');
		expect(result.remainder.timer).toMatchObject({ id, isDraft: true, date: boundary.date, startTime: boundary.time, endTime: null, description: 'Right part' });
		expect(await linkedEntryIds()).toContain(result.left.entry.id);

		// The same request again (a retry after a lost answer or a resize): the first outcome, no second entry
		const retry = await authPost('/api/timer/split', body);
		expect(retry.status).toBe(200);
		const replay = await retry.json();
		expect(replay.replayed).toBe(true);
		expect(replay.left.entry.id).toBe(result.left.entry.id);
		expect(replay.remainder.timer.id).toBe(id);
		const day = await (await authGet(`/api/time-entries?from=${start.date}&to=${start.date}`)).json();
		const leftCopies = day.entries.filter((entry: { description: string | null }) => entry.description?.startsWith(`Left ${runTag}`));
		expect(leftCopies).toHaveLength(1);

		// A new request that still shows the old start: refused, nothing written
		const stale = await authPost('/api/timer/split', { ...body, clientRequestId: `split-stale-${runTag}`, boundary: minutesAgo(45).text });
		expect(stale.status).toBe(409);
		expect((await stale.json()).code).toBe('timer_changed');
		const { timer } = await (await authGet('/api/timer/status')).json();
		expect(timer.startTime).toBe(boundary.time);
	});

	it('the same split sent twice at once is made once (the second waits on the row lock, then replays)', async () => {
		const { id, start } = await startTimer(70);
		const body = {
			entryId: id,
			expectedStartedAt: start.text,
			boundary: minutesAgo(65).text,
			clientRequestId: `split-race-${runTag}`,
			left: { action: 'save', contractId, description: `Race ${runTag}` },
			right: { contractId }
		};
		const answers = await Promise.all([authPost('/api/timer/split', body), authPost('/api/timer/split', body)]);
		expect(answers.map((answer) => answer.status)).toEqual([200, 200]);
		const results = await Promise.all(answers.map((answer) => answer.json()));
		expect(results.map((result) => result.replayed).sort()).toEqual([false, true]);
		expect(results[0].left.entry.id).toBe(results[1].left.entry.id);
	});

	it('discards the left part of a stopped draft, keeping its end', async () => {
		const { id, start } = await startTimer(50);
		const stopped = await (await authPost('/api/timer/stop', {})).json();
		const boundary = minutesAgo(20);
		const response = await authPost('/api/timer/split', {
			entryId: id,
			expectedStartedAt: start.text,
			boundary: boundary.text,
			clientRequestId: `split-discard-${runTag}`,
			left: { action: 'discard' },
			right: { contractId }
		});
		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result.left).toEqual({ action: 'discarded', date: start.date, startTime: start.time, endTime: boundary.time });
		expect(result.remainder.timer).toMatchObject({ id, startTime: boundary.time, endTime: stopped.endTime });
		expect(result.remainder.timer.durationMinutes).toBeGreaterThanOrEqual(20);
		expect(result.remainder.timer.durationMinutes).toBeLessThanOrEqual(21);
	});

	it('hands a blank remainder back as a pending browser timer', async () => {
		const { id, start } = await startTimer(30);
		const boundary = minutesAgo(10);
		const response = await authPost('/api/timer/split', {
			entryId: id,
			expectedStartedAt: start.text,
			boundary: boundary.text,
			clientRequestId: `split-pending-${runTag}`,
			left: { action: 'save', contractId, description: 'Before the call' },
			right: { description: 'The call' }
		});
		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result.remainder).toEqual({ kind: 'pending', date: boundary.date, startTime: boundary.time, description: 'The call' });
		expect((await (await authGet('/api/timer/status')).json()).timer).toBeNull();
	});

	it('refuses a saved entry, a boundary outside the run and a foreign contract, writing nothing', async () => {
		const { id, start } = await startTimer(30);
		const outside = await authPost('/api/timer/split', {
			entryId: id,
			expectedStartedAt: start.text,
			boundary: start.text,
			clientRequestId: `split-outside-${runTag}`,
			left: { action: 'discard' }
		});
		expect(outside.status).toBe(400);
		expect((await outside.json()).code).toBe('boundary_outside');
		const foreign = await authPost('/api/timer/split', {
			entryId: id,
			expectedStartedAt: start.text,
			boundary: minutesAgo(10).text,
			clientRequestId: `split-foreign-${runTag}`,
			left: { action: 'save', contractId: '00000000-0000-4000-8000-000000000000' }
		});
		expect(foreign.status).toBe(403);

		// Save the draft, then try to split the saved entry
		expect((await authPost('/api/timer/save', { entryId: id, contractId })).status).toBe(200);
		const notDraft = await authPost('/api/timer/split', {
			entryId: id,
			expectedStartedAt: start.text,
			boundary: minutesAgo(10).text,
			clientRequestId: `split-saved-${runTag}`,
			left: { action: 'discard' },
			right: { contractId }
		});
		expect(notDraft.status).toBe(409);
		expect((await notDraft.json()).code).toBe('not_a_draft');
		expect((await authGet(`/api/time-entries/${id}`)).status).toBe(200);
	});
});

describe('Resume, and the draft-only guard on save and discard', () => {
	it('resumes a stopped draft from its start (PATCH /api/timer resume)', async () => {
		const { id, start } = await startTimer(25);
		await authPost('/api/timer/stop', {});
		// Earlier tests saved entries in this window: resuming over them asks first, as moving a start does
		const asked = await authPatch('/api/timer', { resume: true, expectedStartedAt: start.text });
		expect(asked.status).toBe(409);
		expect((await asked.json()).code).toBe('start_overlaps_entry');
		const response = await authPatch('/api/timer', { resume: true, expectedStartedAt: start.text, confirmed: true });
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ id, startTime: start.time, endTime: null, durationMinutes: 0 });
	});

	it('a stale device cannot overwrite or delete an entry saved elsewhere (409 not_a_draft)', async () => {
		const { id } = await startTimer(15);
		await authPost('/api/timer/stop', {});
		const saved = await authPost('/api/timer/save', { entryId: id, contractId, description: `Saved first ${runTag}` });
		expect(saved.status).toBe(200);

		const overwrite = await authPost('/api/timer/save', { entryId: id, contractId, description: 'Stale copy' });
		expect(overwrite.status).toBe(409);
		expect((await overwrite.json()).code).toBe('not_a_draft');
		const discard = await authPost('/api/timer/discard', { entryId: id });
		expect(discard.status).toBe(409);
		expect((await discard.json()).code).toBe('not_a_draft');

		const { entry } = await (await authGet(`/api/time-entries/${id}`)).json();
		expect(entry.description).toBe(`Saved first ${runTag}`);
	});

	it('save and discard check expectedStartedAt when given', async () => {
		const { id, start } = await startTimer(15);
		const stale = await authPost('/api/timer/discard', { entryId: id, expectedStartedAt: `${start.date}T00:00:01` });
		expect(stale.status).toBe(409);
		expect((await stale.json()).code).toBe('timer_changed');
		expect((await authPost('/api/timer/discard', { entryId: id, expectedStartedAt: start.text })).status).toBe(200);
	});

	it('a timer save links the notes in its description', async () => {
		const { id } = await startTimer(10);
		await authPost('/api/timer/stop', {});
		const saved = await authPost('/api/timer/save', { entryId: id, contractId, description: `Worked on [[${noteId}]]` });
		expect(saved.status).toBe(200);
		expect(await linkedEntryIds()).toContain(id);
	});
});
