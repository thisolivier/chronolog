/**
 * Sprint 057-DR: week statuses across the year boundary, against the dev database. A week is
 * identified by its Monday, so rows stored with ISO numbers before the 2026-11-07 rule keep their
 * status, and a write renumbers them without tripping the (user, year, week_number) unique key.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { database, users, weeklyStatuses } from '$lib/server/db';
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
	// Legacy rows, ISO-numbered: 28 Dec 2026 was ISO 2026-W53, 4 Jan 2027 was ISO 2027-W01
	await database.insert(weeklyStatuses).values([
		{ userId, weekStart: '2026-12-28', year: 2026, weekNumber: 53, status: 'Draft ready' },
		{ userId, weekStart: '2027-01-04', year: 2027, weekNumber: 1, status: 'Submitted' }
	]);
});

afterAll(async () => {
	await database.delete(users).where(eq(users.id, userId));
	await database.delete(users).where(eq(users.id, duplicateUserId));
});

describe('week statuses at the 2026/2027 boundary', () => {
	it('reads legacy rows by their Monday under the new numbering', async () => {
		const response = await call(weeklyStatusesRoute.GET, { method: 'GET', path: '/api?weeks=2026-W52,2027-W01,2027-W02' });
		expect(await response.json()).toEqual({
			statuses: { '2026-W52': 'Unsubmitted', '2027-W01': 'Draft ready', '2027-W02': 'Submitted' }
		});
		const weekly = await (await call(weeklyRoute.GET, { method: 'GET', path: '/api?weeks=2026-12-28,2027-01-04' })).json();
		expect(weekly.weeks.map((week: { status: string }) => week.status)).toEqual(['Draft ready', 'Submitted']);
	});

	it('writes 2027 Week 1 to the 28 Dec 2026 row and renumbers the legacy rows', async () => {
		const response = await call(weeklyStatusesRoute.POST, {
			method: 'POST',
			path: '/api',
			body: { year: 2027, weekNumber: 1, status: 'Submitted' }
		});
		expect(response.status).toBe(200);
		const rows = await database.select().from(weeklyStatuses).where(eq(weeklyStatuses.userId, userId));
		const byMonday = Object.fromEntries(rows.map((row) => [row.weekStart, row]));
		expect(rows).toHaveLength(2);
		expect(byMonday['2026-12-28']).toMatchObject({ year: 2027, weekNumber: 1, status: 'Submitted' });
		expect(byMonday['2027-01-04']).toMatchObject({ year: 2027, weekNumber: 2, status: 'Submitted' });
	});

	it('accepts a weekStart Monday and refuses a week the year does not have', async () => {
		const byMonday = await call(weeklyStatusesRoute.POST, {
			method: 'POST',
			path: '/api',
			body: { weekStart: '2027-01-04', status: 'Unsubmitted' }
		});
		expect(byMonday.status).toBe(200);
		expect((await byMonday.json()).status).toMatchObject({ weekStart: '2027-01-04', year: 2027, weekNumber: 2, status: 'Unsubmitted' });
		const notMonday = await call(weeklyStatusesRoute.POST, { method: 'POST', path: '/api', body: { weekStart: '2027-01-05', status: 'Submitted' } });
		expect(notMonday.status).toBe(400);
		const week53 = await call(weeklyStatusesRoute.POST, { method: 'POST', path: '/api', body: { year: 2026, weekNumber: 53, status: 'Submitted' } });
		expect(week53.status).toBe(400);
		const badKey = await call(weeklyStatusesRoute.GET, { method: 'GET', path: '/api?weeks=2026-W53' });
		expect(badKey.status).toBe(400);
	});
});

describe('a legacy duplicate Monday (old validation let 2025-W53 roll over to 2025-12-29)', () => {
	beforeAll(async () => {
		await database.insert(users).values({ id: duplicateUserId, name: duplicateUserId, email: `${duplicateUserId}@example.com` });
		await database.insert(weeklyStatuses).values([
			// `chronolog status 2025-W53 submitted` under the old code: ISO 2025 has 52 weeks, so this is 2025-12-29
			{ userId: duplicateUserId, weekStart: '2025-12-29', year: 2025, weekNumber: 53, status: 'Submitted', updatedAt: new Date('2026-01-02T10:00:00Z') },
			{ userId: duplicateUserId, weekStart: '2025-12-29', year: 2026, weekNumber: 1, status: 'Draft ready', updatedAt: new Date('2026-01-05T10:00:00Z') },
			// An ISO-numbered row in a diverging year, to be renumbered too
			{ userId: duplicateUserId, weekStart: '2027-01-04', year: 2027, weekNumber: 1, status: 'Submitted' }
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
		const summary = rows
			.map((row) => `${row.weekStart} ${row.year}-W${row.weekNumber} ${row.status}`)
			.sort();
		expect(summary).toEqual(['2025-12-29 2026-W1 Submitted', '2026-12-28 2027-W1 Submitted', '2027-01-04 2027-W2 Submitted']);
	});
});
