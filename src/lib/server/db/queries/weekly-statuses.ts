import { eq, and } from 'drizzle-orm';
import { database, weeklyStatuses } from '$lib/server/db';
import { getMondayOfIsoWeek } from '$lib/utils/iso-week';

export type WeeklyStatus = typeof weeklyStatuses.$inferSelect;

/** Get the weekly status for a specific ISO week. */
export async function getWeeklyStatus(
	userId: string,
	year: number,
	weekNumber: number
): Promise<WeeklyStatus | null> {
	const results = await database
		.select()
		.from(weeklyStatuses)
		.where(
			and(
				eq(weeklyStatuses.userId, userId),
				eq(weeklyStatuses.year, year),
				eq(weeklyStatuses.weekNumber, weekNumber)
			)
		)
		.limit(1);
	return results[0] ?? null;
}

/** Create or update the weekly status for a specific ISO week. */
export async function upsertWeeklyStatus(
	userId: string,
	year: number,
	weekNumber: number,
	status: string
): Promise<WeeklyStatus> {
	const weekStart = getMondayOfIsoWeek(year, weekNumber);

	const existing = await getWeeklyStatus(userId, year, weekNumber);

	if (existing) {
		const results = await database
			.update(weeklyStatuses)
			.set({ status, updatedAt: new Date() })
			.where(
				and(
					eq(weeklyStatuses.userId, userId),
					eq(weeklyStatuses.year, year),
					eq(weeklyStatuses.weekNumber, weekNumber)
				)
			)
			.returning();
		return results[0];
	}

	const results = await database
		.insert(weeklyStatuses)
		.values({ userId, year, weekNumber, weekStart, status })
		.returning();
	return results[0];
}

/** List all weekly statuses for a given year. */
export async function listWeeklyStatuses(
	userId: string,
	year: number
): Promise<WeeklyStatus[]> {
	return database
		.select()
		.from(weeklyStatuses)
		.where(and(eq(weeklyStatuses.userId, userId), eq(weeklyStatuses.year, year)))
		.orderBy(weeklyStatuses.weekNumber);
}
