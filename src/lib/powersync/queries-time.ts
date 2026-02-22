/**
 * PowerSync Read Queries — Timer, Deliverables, Work Types
 *
 * Reads time-tracking related data from the local PowerSync SQLite database.
 * Returns properly typed results with camelCase field names.
 *
 * PowerSync sync rules handle user scoping — no user_id filters needed.
 * Booleans are stored as 0/1 integers in SQLite.
 * Timestamps are stored as ISO strings.
 */

import type { PowerSyncDatabase } from '@powersync/web';
import type { TimerEntry, DeliverableOption, WorkTypeOption } from '$lib/services/types';

// ── Timer ───────────────────────────────────────────────────

export async function queryTimerStatus(
	database: PowerSyncDatabase
): Promise<TimerEntry | null> {
	const rows = await database.getAll<{
		id: string;
		start_time: string | null;
		end_time: string | null;
		duration_minutes: number;
	}>(
		`SELECT id, start_time, end_time, duration_minutes FROM time_entries WHERE is_draft = 1 LIMIT 1`
	);

	if (rows.length === 0) return null;

	const row = rows[0];
	return {
		id: row.id,
		startTime: row.start_time,
		endTime: row.end_time,
		durationMinutes: row.duration_minutes
	};
}

// ── Deliverables & Work Types ───────────────────────────────

export async function queryDeliverables(
	database: PowerSyncDatabase,
	contractId: string
): Promise<DeliverableOption[]> {
	const rows = await database.getAll<{
		id: string;
		name: string;
	}>(
		`SELECT id, name FROM deliverables WHERE contract_id = ? ORDER BY sort_order`,
		[contractId]
	);

	return rows.map((row) => ({
		id: row.id,
		name: row.name
	}));
}

export async function queryWorkTypes(
	database: PowerSyncDatabase,
	deliverableId: string
): Promise<WorkTypeOption[]> {
	const rows = await database.getAll<{
		id: string;
		name: string;
	}>(
		`SELECT id, name FROM work_types WHERE deliverable_id = ? ORDER BY sort_order`,
		[deliverableId]
	);

	return rows.map((row) => ({
		id: row.id,
		name: row.name
	}));
}
