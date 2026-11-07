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

type AnyHandler = (event: never) => Response | Promise<Response>;

async function call(handler: AnyHandler, options: { method: 'GET' | 'POST'; path: string; body?: object }) {
	const url = new URL(`http://localhost${options.path}`);
	const request = new Request(url, {
		method: options.method,
		headers: { 'Content-Type': 'application/json' },
		body: options.body ? JSON.stringify(options.body) : undefined
	});
	return handler({ locals: { user: { id: userId }, session: null }, request, url, params: {} } as never);
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
