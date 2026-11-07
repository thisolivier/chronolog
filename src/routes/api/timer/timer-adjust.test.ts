/**
 * Sprint 041-CL: `PATCH /api/timer` moves the running timer's start, and `POST /api/timer/start`
 * checks a given start the same way. Handlers run against the dev database with qa-041 users.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { database, clients, contracts, users, timeEntries } from '$lib/server/db';
import * as timerRoute from './+server';
import * as startRoute from './start/+server';
import * as stopRoute from './stop/+server';

type AnyHandler = (event: never) => Response | Promise<Response>;

const suffix = `${Date.now()}`.slice(-6);
const ownerId = `qa-041-timer-owner-${suffix}`;
let contractId = '';

const pad = (value: number) => String(value).padStart(2, '0');
/** Local date and time `minutesAgo` minutes before now (negative: in the future). */
function momentMinutesAgo(minutesAgo: number) {
	const moment = new Date(Date.now() - minutesAgo * 60_000);
	return {
		date: `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`,
		time: `${pad(moment.getHours())}:${pad(moment.getMinutes())}:00`
	};
}

async function call(handler: AnyHandler, options: { userId?: string; method: string; path: string; body?: unknown }) {
	const url = new URL(`http://localhost${options.path}`);
	const request = new Request(url, {
		method: options.method,
		headers: { 'Content-Type': 'application/json' },
		body: options.body === undefined ? undefined : JSON.stringify(options.body)
	});
	const event = { locals: { user: options.userId ? { id: options.userId } : null, session: null }, request, url, params: {} };
	try {
		return await handler(event as never);
	} catch (thrown) {
		const httpError = thrown as { status?: number; body?: { message?: string } };
		if (typeof httpError.status === 'number') {
			return new Response(JSON.stringify({ error: httpError.body?.message }), { status: httpError.status });
		}
		throw thrown;
	}
}

const patchTimer = (body: unknown, userId = ownerId) =>
	call(timerRoute.PATCH as AnyHandler, { userId, method: 'PATCH', path: '/api/timer', body });
const startTimer = (body: unknown) =>
	call(startRoute.POST as AnyHandler, { userId: ownerId, method: 'POST', path: '/api/timer/start', body });

async function startTimerMinutesAgo(minutesAgo: number) {
	const start = momentMinutesAgo(minutesAgo);
	const response = await startTimer({ contractId, date: start.date, startTime: start.time, confirmed: true });
	expect(response.status).toBe(201);
	return (await response.json()) as { id: string };
}

async function addSavedEntry(fromMinutesAgo: number, toMinutesAgo: number) {
	const from = momentMinutesAgo(fromMinutesAgo);
	const to = momentMinutesAgo(toMinutesAgo);
	const [entry] = await database
		.insert(timeEntries)
		.values({
			userId: ownerId,
			contractId,
			date: from.date,
			startTime: from.time,
			endTime: to.time,
			durationMinutes: fromMinutesAgo - toMinutesAgo,
			isDraft: false
		})
		.returning();
	return entry;
}

beforeAll(async () => {
	await database.insert(users).values({ id: ownerId, name: ownerId, email: `${ownerId}@example.com` });
	const [client] = await database.insert(clients).values({ userId: ownerId, name: 'Timer client', shortCode: `QA${suffix}` }).returning();
	const [contract] = await database.insert(contracts).values({ clientId: client.id, name: 'Timer work' }).returning();
	contractId = contract.id;
});

beforeEach(async () => {
	await database.delete(timeEntries).where(eq(timeEntries.userId, ownerId));
});

afterAll(async () => {
	await database.delete(timeEntries).where(eq(timeEntries.userId, ownerId));
	const ownedClients = await database.select({ id: clients.id }).from(clients).where(eq(clients.userId, ownerId));
	await database.delete(contracts).where(inArray(contracts.clientId, ownedClients.map((client) => client.id)));
	await database.delete(clients).where(eq(clients.userId, ownerId));
	await database.delete(users).where(eq(users.id, ownerId));
});

describe('PATCH /api/timer', () => {
	it('401 without a user, 400 for a malformed start, 404 without a running timer', async () => {
		expect((await call(timerRoute.PATCH as AnyHandler, { method: 'PATCH', path: '/api/timer', body: {} })).status).toBe(401);
		const malformed = await patchTimer({ startTime: '9.30' });
		expect(malformed.status).toBe(400);
		expect((await malformed.json()).code).toBe('invalid_start');
		expect((await patchTimer({ startTime: '09:30', date: '2026-02-30' })).status).toBe(400);
		const missing = await patchTimer({ startTime: momentMinutesAgo(5).time });
		expect(missing.status).toBe(404);
		expect((await missing.json()).code).toBe('no_running_timer');
	});

	it('moves the start earlier; stopping then measures from the new start', async () => {
		const timer = await startTimerMinutesAgo(1);
		const newStart = momentMinutesAgo(90);
		const response = await patchTimer({ date: newStart.date, startTime: newStart.time.slice(0, 5) });
		expect(response.status).toBe(200);
		const moved = await response.json();
		expect(moved.id).toBe(timer.id);
		expect(moved.startTime).toBe(newStart.time);
		expect(moved.date).toBe(newStart.date);
		expect(moved.contractName).toBe('Timer work');

		const stopped = await (await call(stopRoute.POST as AnyHandler, { userId: ownerId, method: 'POST', path: '/api/timer/stop', body: {} })).json();
		expect(stopped.durationMinutes).toBeGreaterThanOrEqual(90);
		expect(stopped.durationMinutes).toBeLessThanOrEqual(91);
		// Sprint 056-DR: a stopped timer's start moves too; its end stays and the duration is re-measured
		const laterStart = momentMinutesAgo(30);
		const afterStop = await patchTimer({ date: laterStart.date, startTime: laterStart.time });
		expect(afterStop.status).toBe(200);
		const movedStopped = await afterStop.json();
		expect(movedStopped.endTime).toBe(stopped.endTime);
		expect(movedStopped.durationMinutes).toBeGreaterThanOrEqual(30);
		expect(movedStopped.durationMinutes).toBeLessThanOrEqual(31);
		// ...but never to or past the end
		const pastEnd = await patchTimer({ startTime: stopped.endTime });
		expect(pastEnd.status).toBe(400);
		expect((await pastEnd.json()).code).toBe('invalid_start');
	});

	it('resumes a stopped timer from its start; refuses to resume a running one (sprint 056-DR)', async () => {
		const timer = await startTimerMinutesAgo(40);
		expect((await patchTimer({ resume: true })).status).toBe(409);
		await call(stopRoute.POST as AnyHandler, { userId: ownerId, method: 'POST', path: '/api/timer/stop', body: {} });
		const start = momentMinutesAgo(40);
		const stale = await patchTimer({ resume: true, expectedStartedAt: `${start.date}T00:00:01` });
		expect(stale.status).toBe(409);
		expect((await stale.json()).code).toBe('timer_changed');
		const resumed = await patchTimer({ resume: true, expectedStartedAt: `${start.date}T${start.time}` });
		expect(resumed.status).toBe(200);
		const running = await resumed.json();
		expect(running.id).toBe(timer.id);
		expect(running.endTime).toBeNull();
		expect(running.startTime).toBe(start.time);
		expect(running.durationMinutes).toBe(0);
	});

	it('refuses a start in the future or more than a day ago', async () => {
		await startTimerMinutesAgo(1);
		const future = momentMinutesAgo(-10);
		const futureResponse = await patchTimer({ date: future.date, startTime: future.time });
		expect(futureResponse.status).toBe(400);
		expect((await futureResponse.json()).code).toBe('start_in_future');
		const tooEarly = momentMinutesAgo(25 * 60);
		const earlyResponse = await patchTimer({ date: tooEarly.date, startTime: tooEarly.time, confirmed: true });
		expect(earlyResponse.status).toBe(400);
		expect((await earlyResponse.json()).code).toBe('start_too_early');
	});

	it('asks before overlapping a saved entry, and keeps the start once confirmed', async () => {
		const entry = await addSavedEntry(120, 60);
		await startTimerMinutesAgo(1);
		const overlappingStart = momentMinutesAgo(90);
		const refused = await patchTimer({ date: overlappingStart.date, startTime: overlappingStart.time });
		expect(refused.status).toBe(409);
		const refusal = await refused.json();
		expect(refusal.code).toBe('start_overlaps_entry');
		expect(refusal.overlappingEntry).toMatchObject({ id: entry.id, clientName: 'Timer client', contractName: 'Timer work' });
		expect(refusal.message).toContain('Timer client / Timer work');

		const confirmed = await patchTimer({ date: overlappingStart.date, startTime: overlappingStart.time, confirmed: true });
		expect(confirmed.status).toBe(200);
		expect((await confirmed.json()).startTime).toBe(overlappingStart.time);

		// Starting after the entry ended needs no confirmation
		const afterEntry = momentMinutesAgo(45);
		expect((await patchTimer({ date: afterEntry.date, startTime: afterEntry.time })).status).toBe(200);
	});
});

describe('POST /api/timer/start with a chosen start', () => {
	it('refuses a future start unless confirmed (a browser clock ahead of the server still starts)', async () => {
		const future = momentMinutesAgo(-30);
		const response = await startTimer({ contractId, date: future.date, startTime: future.time });
		expect(response.status).toBe(400);
		expect((await response.json()).code).toBe('start_in_future');
		const browserStart = momentMinutesAgo(-3);
		expect((await startTimer({ contractId, date: browserStart.date, startTime: browserStart.time, confirmed: true })).status).toBe(201);
	});

	it('asks before overlapping a saved entry unless confirmed', async () => {
		await addSavedEntry(120, 60);
		const start = momentMinutesAgo(90);
		const refused = await startTimer({ contractId, date: start.date, startTime: start.time });
		expect(refused.status).toBe(409);
		expect((await refused.json()).code).toBe('start_overlaps_entry');
		const started = await startTimer({ contractId, date: start.date, startTime: start.time, confirmed: true });
		expect(started.status).toBe(201);
		expect((await started.json()).startTime).toBe(start.time);
	});
});
