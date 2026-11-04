/**
 * Admin commands for deliverables and work types (sprint 031-CL). The UI calls the second level
 * "work types"; `tag` / `tags` are accepted as aliases (see chronolog.mjs). `remove` asks first
 * and prints how many entries kept a "Formerly: …" line.
 */

import { UsageError } from '../lib/args.mjs';
import { confirmRemoval } from '../lib/confirm.mjs';
import { formatMinutes } from '../lib/dates.mjs';
import {
	deliverablePath,
	findContract,
	findDeliverable,
	findWorkType,
	listDeliverables,
	listWorkTypes,
	workTypePath
} from '../lib/object-refs.mjs';

function parseOrder(flags) {
	if (flags.order === undefined) return undefined;
	const sortOrder = Number(flags.order);
	if (!Number.isInteger(sortOrder)) throw new UsageError('--order must be a whole number.');
	return sortOrder;
}

function editBody(flags, usage) {
	const body = {};
	if (flags.name !== undefined) body.name = String(flags.name);
	const sortOrder = parseOrder(flags);
	if (sortOrder !== undefined) body.sortOrder = sortOrder;
	if (Object.keys(body).length === 0) throw new UsageError(`Nothing to change. ${usage}`);
	return body;
}

function entriesText(usage) {
	return usage.timeEntryCount
		? `${usage.timeEntryCount} time ${usage.timeEntryCount === 1 ? 'entry' : 'entries'} (${formatMinutes(usage.totalMinutes)})`
		: 'no time entries';
}

// ── deliverables ────────────────────────────────────────────────────

export async function deliverables({ api, print, positionals, flags }) {
	const reference = positionals.join(' ');
	if (!reference) throw new UsageError('Usage: chronolog deliverables <contract> [--all]');
	const contract = await findContract(api, reference);
	const rows = await listDeliverables(api, contract.id, { includeArchived: Boolean(flags.all) });
	const lines = rows.map((row) => `${String(row.sortOrder).padStart(3)}  ${row.name}  id=${row.id}`);
	const archivedNote = rows.length === 0 && (contract.archived || contract.clientArchived) && !flags.all ? ' (archived contract: add --all)' : '';
	print([`Deliverables of ${contract.clientShortCode}/${contract.name}: ${rows.length}${archivedNote}`, ...lines].join('\n'), rows);
}

export async function deliverableAdd({ api, print, positionals, flags }) {
	const [contractReference, ...nameWords] = positionals;
	const name = nameWords.join(' ').trim();
	if (!contractReference || !name) throw new UsageError('Usage: chronolog deliverable add <contract> "<name>" [--order N]');
	const contract = await findContract(api, contractReference);
	const body = { contractId: contract.id, name };
	const sortOrder = parseOrder(flags);
	if (sortOrder !== undefined) body.sortOrder = sortOrder;
	const { deliverable } = await api.post('/api/deliverables', body);
	print(`Created deliverable ${deliverablePath({ ...deliverable, contract })}  id=${deliverable.id}`, deliverable);
}

export async function deliverableEdit({ api, print, positionals, flags }) {
	const usage = 'Usage: chronolog deliverable edit <SHORT/Contract/Deliverable | id> [--name "..."] [--order N]';
	const reference = positionals.join(' ');
	if (!reference) throw new UsageError(usage);
	const body = editBody(flags, usage);
	const found = await findDeliverable(api, reference);
	const { deliverable } = await api.patch(`/api/deliverables/${found.id}`, body);
	print(`Saved deliverable ${deliverablePath({ ...deliverable, contract: found.contract })}  id=${deliverable.id}`, deliverable);
}

export async function deliverableRemove({ api, print, positionals, flags, stdin }) {
	const reference = positionals.join(' ');
	if (!reference) throw new UsageError('Usage: chronolog deliverable remove <SHORT/Contract/Deliverable | id> [--yes]');
	const found = await findDeliverable(api, reference);
	const { usage } = await api.get(`/api/deliverables/${found.id}`);
	await confirmRemoval({
		flags,
		stdin,
		summary: `Deliverable ${deliverablePath(found)} is on ${entriesText(usage)}; removing it deletes its work types, and those entries stay on the contract with “Formerly: ${found.name}” in their description.`
	});
	const result = await api.delete(`/api/deliverables/${found.id}`);
	print(result.message, result);
}

// ── work types ──────────────────────────────────────────────────────

export async function workTypes({ api, print, positionals, flags }) {
	const reference = positionals.join(' ');
	if (!reference) throw new UsageError('Usage: chronolog work-types <SHORT/Contract/Deliverable | id> [--all]');
	const deliverable = await findDeliverable(api, reference);
	const rows = await listWorkTypes(api, deliverable.id, { includeArchived: Boolean(flags.all) });
	const lines = rows.map((row) => `${String(row.sortOrder).padStart(3)}  ${row.name}  id=${row.id}`);
	print([`Work types of ${deliverablePath(deliverable)}: ${rows.length}`, ...lines].join('\n'), rows);
}

export async function workTypeAdd({ api, print, positionals, flags }) {
	const [deliverableReference, ...nameWords] = positionals;
	const name = nameWords.join(' ').trim();
	if (!deliverableReference || !name) {
		throw new UsageError('Usage: chronolog work-type add <SHORT/Contract/Deliverable | id> "<name>" [--order N]');
	}
	const deliverable = await findDeliverable(api, deliverableReference);
	const body = { deliverableId: deliverable.id, name };
	const sortOrder = parseOrder(flags);
	if (sortOrder !== undefined) body.sortOrder = sortOrder;
	const { workType } = await api.post('/api/work-types', body);
	print(`Created work type ${workTypePath({ ...workType, deliverable })}  id=${workType.id}`, workType);
}

export async function workTypeEdit({ api, print, positionals, flags }) {
	const usage = 'Usage: chronolog work-type edit <SHORT/Contract/Deliverable/WorkType | id> [--name "..."] [--order N]';
	const reference = positionals.join(' ');
	if (!reference) throw new UsageError(usage);
	const body = editBody(flags, usage);
	const found = await findWorkType(api, reference);
	const { workType } = await api.patch(`/api/work-types/${found.id}`, body);
	print(`Saved work type ${workTypePath({ ...workType, deliverable: found.deliverable })}  id=${workType.id}`, workType);
}

export async function workTypeRemove({ api, print, positionals, flags, stdin }) {
	const reference = positionals.join(' ');
	if (!reference) throw new UsageError('Usage: chronolog work-type remove <SHORT/Contract/Deliverable/WorkType | id> [--yes]');
	const found = await findWorkType(api, reference);
	const { usage } = await api.get(`/api/work-types/${found.id}`);
	await confirmRemoval({
		flags,
		stdin,
		summary: `Work type ${workTypePath(found)} is on ${entriesText(usage)}; those entries keep their deliverable, with “Formerly: ${found.deliverable.name} / ${found.name}” in their description.`
	});
	const result = await api.delete(`/api/work-types/${found.id}`);
	print(result.message, result);
}
