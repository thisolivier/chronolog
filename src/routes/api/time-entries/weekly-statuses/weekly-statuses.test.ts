/**
 * Sprints 057-DR / 061-DR: week statuses across the year boundary, against the dev database. A week
 * is identified by its Monday; keys are ISO 8601. Rows numbered by v1.5.0's "Week 1 contains
 * 1 January" rule keep their status, and a write renumbers them to ISO without tripping the
 * (user, year, week_number) unique key.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { database, users, weeklyStatuses } from '$lib/server/db';
import { normaliseWeeklyStatusRows } from '$lib/server/db/queries/weekly-statuses';
import * as weeklyStatusesRoute from './+server';
import * as weeklyRoute from '../weekly/+server';

const userId = `qa-057-weeks-${Date.now().toString(36)}`;
const duplicateUserId = `qa-057-dup-${Date.now().toString(36)}`;

type AnyHandler = (event: never) => Response | Promise<Response>;

async function call(handler: AnyHandler, options: { method: 'GET' | 'POST'; path: string; body?: object; asUser?: string }) {
	const url = new URL(`http://localhost${options.path}`);
	const request = new Request(url, {
		method: options.method,
		headers: { 'Content-Type': 'application/json' },
		body: options.body ? JSON.stringify(options.body) : undefined
	});
	return handler({ locals: { user: { id: options.asUser ?? userId }, session: null }, request, url, params: {} } as never);
}

beforeAll(async () => {
	await database.insert(users).values({ id: userId, name: userId, email: `${userId}@example.com` });
	// Rows a v1.5.0 client could write: calendar-year numbers, which differ from ISO from 28 Dec 2026
	await database.insert(weeklyStatuses).values([
		{ userId, weekStart: '2026-12-28', year: 2027, weekNumber: 1, status: 'Draft ready' },
		{ userId, weekStart: '2027-01-04', year: 2027, weekNumber: 2, status: 'Submitted' }
	]);
});

afterAll(async () => {
	await database.delete(users).where(eq(users.id, userId));
	await database.delete(users).where(eq(users.id, duplicateUserId));
});

function summarise(rows: (typeof weeklyStatuses.$inferSelect)[]): string[] {
	return rows.map((row) => `${row.weekStart} ${row.year}-W${row.weekNumber} ${row.status}`).sort();
}

describe('week statuses at the 2026/2027 boundary (ISO 8601)', () => {
	it('reads calendar-year-numbered rows by their Monday under ISO keys', async () => {
		const response = await call(weeklyStatusesRoute.GET, { method: 'GET', path: '/api?weeks=2026-W52,2026-W53,2027-W01' });
		expect(await response.json()).toEqual({
			statuses: { '2026-W52': 'Unsubmitted', '2026-W53': 'Draft ready', '2027-W01': 'Submitted' }
		});
		const weekly = await (await call(weeklyRoute.GET, { method: 'GET', path: '/api?weeks=2026-12-28,2027-01-04' })).json();
		expect(weekly.weeks.map((week: { status: string }) => week.status)).toEqual(['Draft ready', 'Submitted']);
	});

	it('writes ISO 2027-W02 (11 Jan) after renumbering the stored rows, whose (2027, 2) would collide', async () => {
		const response = await call(weeklyStatusesRoute.POST, {
			method: 'POST',
			path: '/api',
			body: { year: 2027, weekNumber: 2, status: 'Submitted' }
		});
		expect(response.status).toBe(200);
		expect((await response.json()).status).toMatchObject({ weekStart: '2027-01-11', year: 2027, weekNumber: 2 });
		const rows = await database.select().from(weeklyStatuses).where(eq(weeklyStatuses.userId, userId));
		expect(summarise(rows)).toEqual([
			'2026-12-28 2026-W53 Draft ready',
			'2027-01-04 2027-W1 Submitted',
			'2027-01-11 2027-W2 Submitted'
		]);
	});

	it('renumbering is idempotent: a second pass changes nothing', async () => {
		const before = await database.select().from(weeklyStatuses).where(eq(weeklyStatuses.userId, userId));
		await database.transaction((transaction) => normaliseWeeklyStatusRows(transaction, userId));
		const after = await database.select().from(weeklyStatuses).where(eq(weeklyStatuses.userId, userId));
		expect(after.map((row) => ({ ...row })).sort((first, second) => first.id.localeCompare(second.id))).toEqual(
			before.map((row) => ({ ...row })).sort((first, second) => first.id.localeCompare(second.id))
		);
	});

	it('accepts a weekStart Monday and W53 only in a 53-week ISO year', async () => {
		const byMonday = await call(weeklyStatusesRoute.POST, {
			method: 'POST',
			path: '/api',
			body: { weekStart: '2027-01-04', status: 'Unsubmitted' }
		});
		expect(byMonday.status).toBe(200);
		expect((await byMonday.json()).status).toMatchObject({ weekStart: '2027-01-04', year: 2027, weekNumber: 1, status: 'Unsubmitted' });
		const notMonday = await call(weeklyStatusesRoute.POST, { method: 'POST', path: '/api', body: { weekStart: '2027-01-05', status: 'Submitted' } });
		expect(notMonday.status).toBe(400);
		const week53 = await call(weeklyStatusesRoute.POST, { method: 'POST', path: '/api', body: { year: 2026, weekNumber: 53, status: 'Submitted' } });
		expect(week53.status).toBe(200);
		expect((await week53.json()).status).toMatchObject({ weekStart: '2026-12-28', year: 2026, weekNumber: 53 });
		const missingWeek53 = await call(weeklyStatusesRoute.POST, { method: 'POST', path: '/api', body: { year: 2025, weekNumber: 53, status: 'Submitted' } });
		expect(missingWeek53.status).toBe(400);
		const badKey = await call(weeklyStatusesRoute.GET, { method: 'GET', path: '/api?weeks=2027-W53' });
		expect(badKey.status).toBe(400);
	});
});

describe('a legacy duplicate Monday (old validation let 2025-W53 roll over to 2025-12-29)', () => {
	beforeAll(async () => {
		await database.insert(users).values({ id: duplicateUserId, name: duplicateUserId, email: `${duplicateUserId}@example.com` });
		await database.insert(weeklyStatuses).values([
			// `chronolog status 2025-W53 submitted` under pre-057 code: ISO 2025 has 52 weeks, so this is 2025-12-29
			{ userId: duplicateUserId, weekStart: '2025-12-29', year: 2025, weekNumber: 53, status: 'Submitted', updatedAt: new Date('2026-01-02T10:00:00Z') },
			{ userId: duplicateUserId, weekStart: '2025-12-29', year: 2026, weekNumber: 1, status: 'Draft ready', updatedAt: new Date('2026-01-05T10:00:00Z') },
			// A calendar-year-numbered row (v1.5.0), to be renumbered to ISO 2026-W53 too
			{ userId: duplicateUserId, weekStart: '2026-12-28', year: 2027, weekNumber: 1, status: 'Submitted' }
		]);
	});

	it('reads the most recently updated row for that Monday', async () => {
		const response = await call(weeklyStatusesRoute.GET, { method: 'GET', path: '/api?weeks=2026-W01', asUser: duplicateUserId });
		expect((await response.json()).statuses).toEqual({ '2026-W01': 'Draft ready' });
	});

	it('a status write keeps the newest duplicate, deletes the other and renumbers, and later writes keep working', async () => {
		const first = await call(weeklyStatusesRoute.POST, {
			method: 'POST',
			path: '/api',
			body: { year: 2027, weekNumber: 1, status: 'Submitted' },
			asUser: duplicateUserId
		});
		expect(first.status).toBe(200);
		const second = await call(weeklyStatusesRoute.POST, {
			method: 'POST',
			path: '/api',
			body: { year: 2026, weekNumber: 1, status: 'Submitted' },
			asUser: duplicateUserId
		});
		expect(second.status).toBe(200);
		const rows = await database.select().from(weeklyStatuses).where(eq(weeklyStatuses.userId, duplicateUserId));
		expect(summarise(rows)).toEqual(['2025-12-29 2026-W1 Submitted', '2026-12-28 2026-W53 Submitted', '2027-01-04 2027-W1 Submitted']);
	});
});
