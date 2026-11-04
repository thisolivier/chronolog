/** Corrections: edit one entry, undo the last entry this CLI logged (sprint 029-CL). */

import { resolveDeliverable } from '../lib/resolve.mjs';
import { formatMinutes, resolveDateWord } from '../lib/dates.mjs';
import { UsageError } from '../lib/args.mjs';
import { clearLastEntry, readLastEntry } from '../lib/history.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLEAR_WORDS = new Set(['none', '-', '']);

export function describeEntry(entry) {
	const range = entry.startTime && entry.endTime ? ` (${entry.startTime.slice(0, 5)}-${entry.endTime.slice(0, 5)})` : '';
	const where = entry.clientShortCode ? ` ${entry.clientShortCode}/${entry.contractName}` : '';
	const deliverable = entry.deliverableName ? ` [${entry.deliverableName}]` : '';
	return `${formatMinutes(entry.durationMinutes)}${range} on ${entry.date}${where}${deliverable}: ${entry.description ?? ''}`;
}

export async function edit({ api, print, positionals, flags }) {
	const [entryId] = positionals;
	const usage = 'Usage: chronolog edit <entry-id> [--duration D] [--description "..."] [--date D] [--deliverable X|none]';
	if (!entryId) throw new UsageError(usage);
	if (!UUID_PATTERN.test(entryId)) throw new UsageError(`Entry id must be a UUID (the id= printed by log or week), not “${entryId}”.`);

	const body = {};
	if (flags.duration !== undefined) body.duration = flags.duration;
	if (flags.description !== undefined) body.description = flags.description;
	if (flags.date !== undefined) {
		const { today } = await api.get('/api/me');
		const date = resolveDateWord(flags.date, today);
		if (!date) throw new UsageError(`--date must be YYYY-MM-DD, today, yesterday or a weekday name, not “${flags.date}”.`);
		body.date = date;
	}
	if (flags.deliverable !== undefined) {
		if (CLEAR_WORDS.has(String(flags.deliverable).toLowerCase())) {
			body.deliverableId = null;
		} else {
			const { entry } = await api.get(`/api/time-entries/${entryId}`);
			const deliverables = await api.get(`/api/deliverables?contractId=${entry.contractId}`);
			body.deliverableId = resolveDeliverable(flags.deliverable, deliverables).id;
		}
	}
	if (Object.keys(body).length === 0) throw new UsageError(`Nothing to change. ${usage}`);

	await api.patch(`/api/time-entries/${entryId}`, body);
	const { entry } = await api.get(`/api/time-entries/${entryId}`);
	print(`Updated ${describeEntry(entry)}\nid=${entry.id}`, entry);
}

export async function undo({ api, print, config, environment }) {
	const record = readLastEntry(environment);
	if (!record) throw new UsageError('Nothing to undo: this CLI has no record of a logged entry (only `chronolog log` is undoable).');
	if (record.baseUrl && config.baseUrl && record.baseUrl !== config.baseUrl) {
		throw new UsageError(`The last logged entry was on ${record.baseUrl}, not ${config.baseUrl}; nothing undone.`);
	}

	try {
		await api.delete(`/api/time-entries/${record.entryId}`);
	} catch (failure) {
		if (failure.status === 404) {
			clearLastEntry(environment);
			failure.message = `The last logged entry (${record.summary ?? record.entryId}) no longer exists; nothing undone.`;
		}
		throw failure;
	}
	clearLastEntry(environment);
	print(`Deleted ${record.summary ?? 'entry'}\nid=${record.entryId}`, { deleted: true, entryId: record.entryId, summary: record.summary ?? null });
}
