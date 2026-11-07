/**
 * Checkpoint B/C (design r1) seed: checkpoint A's mock-up names (Amplitude: Hungryroot / Daily Pay
 * / Rank Group; EasyJet: Crew Rostering; Internal: General) plus an ontology and a week of entries,
 * so the acceptance walk and the owner's screenshots read like real work.
 * - Hungryroot: deliverables "Event pipeline" (work types Analysis, Workshop) and "Dashboard" (one
 *   work type, Build: the sole-option case)
 * - Crew Rostering: one deliverable "Summer schedule" with no work types (not applicable below it)
 * - Daily Pay, Rank Group, General: no deliverables
 * - Entries on every day of the current week up to today, several contracts a day, with ranges,
 *   a duration-only entry, a long description and a missing-detail cue.
 */
import type { Page } from '@playwright/test';
import { seedCheckpoint, type CheckpointSeed } from './checkpoint-a-seed';

export type CheckpointBcSeed = CheckpointSeed & {
	generalContractId: string;
	pipelineId: string;
	dashboardId: string;
	analysisId: string;
	buildId: string;
	summerScheduleId: string;
	/** Monday of the current week, `YYYY-MM-DD` (local) */
	monday: string;
	today: string;
	/** An entry today on Hungryroot with no deliverable (the missing-detail cue) */
	cueEntryId: string;
	/** An entry today on Hungryroot > Event pipeline > Analysis */
	pipelineEntryId: string;
};

export async function seedCheckpointBc(page: Page): Promise<CheckpointBcSeed> {
	const base = await seedCheckpoint(page);
	const extra = await page.evaluate(async (base) => {
		const send = async (method: string, url: string, body?: unknown) => {
			const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
			if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
			return response.json();
		};
		const post = (url: string, body: unknown) => send('POST', url, body);
		const pad = (value: number) => String(value).padStart(2, '0');
		const local = (moment: Date) => `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;

		const contracts = (await send('GET', '/api/contracts')) as { id: string; name: string; clientName?: string }[];
		const generalContractId = contracts.find((contract) => contract.name === 'General')!.id;

		const deliverable = async (contractId: string, name: string, sortOrder: number) =>
			(await post('/api/deliverables', { contractId, name, sortOrder })).deliverable.id as string;
		const workType = async (deliverableId: string, name: string, sortOrder: number) =>
			(await post('/api/work-types', { deliverableId, name, sortOrder })).workType.id as string;
		const pipelineId = await deliverable(base.hungryrootId, 'Event pipeline', 0);
		const dashboardId = await deliverable(base.hungryrootId, 'Dashboard', 1);
		const analysisId = await workType(pipelineId, 'Analysis', 0);
		await workType(pipelineId, 'Workshop', 1);
		const buildId = await workType(dashboardId, 'Build', 0);
		const summerScheduleId = await deliverable(base.easyJetContractId, 'Summer schedule', 0);

		const now = new Date();
		const monday = new Date(now);
		monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
		const today = local(now);
		type Row = [string, string, string | null, string | null, string, string | null, number?];
		// [contract, description, deliverable, work type, start, end, duration-only minutes]
		const days: Row[][] = [
			[
				[base.hungryrootId, 'Kick-off with the Hungryroot data team', pipelineId, analysisId, '09:00', '10:30'],
				[base.easyJetContractId, 'Crew rostering constraints from the union agreement', summerScheduleId, null, '11:00', '12:45'],
				[generalContractId, 'Invoicing and admin', null, null, '16:00', '16:30']
			],
			[
				[base.rankGroupId, 'Pricing review: tiered options for the loyalty programme', null, null, '09:30', '11:00'],
				[base.hungryrootId, 'Dashboard wireframes', dashboardId, buildId, '13:00', '15:15'],
				[base.dailyPayId, 'Payroll provider webhooks: retry behaviour', null, null, '15:30', '16:15']
			],
			[
				[base.hungryrootId, 'Event taxonomy review with Brent: isolates, batching, flush sizes and the retention window for the raw event export, with follow-ups for the next review', pipelineId, analysisId, '10:00', '12:00'],
				[base.easyJetContractId, 'Summer schedule scenarios', summerScheduleId, null, '13:30', '15:00'],
				[generalContractId, 'Reading', null, null, '', null, 45]
			],
			[
				[base.dailyPayId, 'Payroll integration questions', null, null, '09:00', '10:00'],
				[base.rankGroupId, 'Loyalty programme workshop prep', null, null, '10:15', '11:45'],
				[base.hungryrootId, 'Pipeline flush interval tests', pipelineId, null, '14:00', '16:30']
			],
			[
				[base.easyJetContractId, 'Crew rostering workshop', summerScheduleId, null, '09:00', '12:00'],
				[base.hungryrootId, 'Weekly sync', null, null, '14:00', '14:45']
			],
			[[generalContractId, 'Week planning', null, null, '10:00', '10:30']]
		];
		let cueEntryId = '';
		let pipelineEntryId = '';
		for (let offset = 0; offset < days.length; offset++) {
			const date = new Date(monday);
			date.setDate(monday.getDate() + offset);
			if (date > now) break;
			const isToday = local(date) === today;
			const rows: Row[] = isToday
				? [
						[base.hungryrootId, 'Event taxonomy follow-up', pipelineId, analysisId, '08:30', '09:40'],
						[base.hungryrootId, 'Notes for Brent', null, null, '09:45', '10:20'],
						[base.rankGroupId, 'Pricing review call', null, null, '10:30', '11:15']
					]
				: days[offset];
			for (const [contractId, description, deliverableId, workTypeId, startTime, endTime, minutes] of rows) {
				const body: Record<string, unknown> = { date: local(date), contractId, description, deliverableId, workTypeId };
				if (minutes) body.durationMinutes = minutes;
				else {
					const toMinutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
					Object.assign(body, { startTime, endTime, durationMinutes: toMinutes(endTime!) - toMinutes(startTime) });
				}
				const created = await post('/api/time-entries', body);
				const id = (created.entry ?? created).id as string;
				if (isToday && description === 'Notes for Brent') cueEntryId = id;
				if (isToday && description === 'Event taxonomy follow-up') pipelineEntryId = id;
			}
		}
		return { generalContractId, pipelineId, dashboardId, analysisId, buildId, summerScheduleId, monday: local(monday), today, cueEntryId, pipelineEntryId };
	}, base);
	return { ...base, ...extra };
}

/** Start a server timer on the contract `minutesAgo` minutes ago (as the owner would mid-session) */
export async function startTimerEarlier(page: Page, contractId: string | null, minutesAgo: number, description = '') {
	await page.evaluate(
		async ({ contractId, minutesAgo, description }) => {
			const started = new Date(Date.now() - minutesAgo * 60_000);
			const pad = (value: number) => String(value).padStart(2, '0');
			const date = `${started.getFullYear()}-${pad(started.getMonth() + 1)}-${pad(started.getDate())}`;
			const startTime = `${pad(started.getHours())}:${pad(started.getMinutes())}`;
			const response = await fetch('/api/timer/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contractId, date, startTime, confirmed: true, description })
			});
			if (!response.ok) throw new Error(`start: ${response.status} ${await response.text()}`);
			// The start request ignores a description: write it on the running row
			if (description) {
				const timer = await response.json();
				await fetch(`/api/time-entries/${timer.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ description })
				});
			}
		},
		{ contractId, minutesAgo, description }
	);
}
