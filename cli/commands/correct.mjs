/** Corrections: edit one entry, undo the last entry this CLI logged (sprint 029-CL). */

import { isClearWord, resolveEntryDeliverable, resolveEntryWorkType } from '../lib/entry-references.mjs';
import { formatMinutes, resolveDateWord } from '../lib/dates.mjs';
import { UsageError } from '../lib/args.mjs';
import { clearLastEntry, readLastEntry } from '../lib/history.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function describeEntry(entry) {
	const range = entry.startTime && entry.endTime ? ` (${entry.startTime.slice(0, 5)}-${entry.endTime.slice(0, 5)})` : '';
	const where = entry.clientShortCode ? ` ${entry.clientShortCode}/${entry.contractName}` : '';
	const deliverableParts = [entry.deliverableName, entry.workTypeName].filter(Boolean);
	const deliverable = deliverableParts.length ? ` [${deliverableParts.join(' > ')}]` : '';
	return `${formatMinutes(entry.durationMinutes)}${range} on ${entry.date}${where}${deliverable}: ${entry.description ?? ''}`;
}

/**
 * `--deliverable X|none` and `--work-type X|none` as PATCH fields. A work type is resolved under
 * the new deliverable when one is given, else the entry's current one. `--deliverable none`
 * clears both, and a new deliverable without `--work-type` clears a work type that belonged to
 * the old one (the server refuses a stale pair).
 */
async function deliverableAndWorkTypeChanges(api, entryId, flags) {
	const workTypeReference = flags.workType ?? flags.tag;
	if (flags.deliverable === undefined && workTypeReference === undefined) return {};

	const changes = {};
	const { entry } = await api.get(`/api/time-entries/${entryId}`);
	let deliverable = entry.deliverableId ? { id: entry.deliverableId, name: entry.deliverableName } : null;

	if (flags.deliverable !== undefined) {
		if (isClearWord(flags.deliverable)) {
			if (workTypeReference !== undefined && !isClearWord(workTypeReference)) {
				throw new UsageError('--deliverable none clears the work type too; a work type needs a deliverable.');
			}
			deliverable = null;
			changes.deliverableId = null;
			changes.workTypeId = null;
		} else {
			deliverable = await resolveEntryDeliverable(api, entry.contractId, flags.deliverable);
			changes.deliverableId = deliverable.id;
			if (workTypeReference === undefined && entry.workTypeId && deliverable.id !== entry.deliverableId) {
				changes.workTypeId = null;
			}
		}
	}

	if (workTypeReference !== undefined) {
		if (isClearWord(workTypeReference)) {
			changes.workTypeId = null;
		} else {
			if (!deliverable) {
				throw new UsageError('This entry has no deliverable; give --deliverable X too (work types belong to a deliverable).');
			}
			changes.workTypeId = (await resolveEntryWorkType(api, deliverable, workTypeReference)).id;
		}
	}
	return changes;
}

export async function edit({ api, print, positionals, flags }) {
	const [entryId] = positionals;
	const usage =
		'Usage: chronolog edit <entry-id> [--duration D] [--description "..."] [--date D] [--deliverable X|none] [--work-type X|none]';
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
	Object.assign(body, await deliverableAndWorkTypeChanges(api, entryId, flags));
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
