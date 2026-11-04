/**
 * Admin commands for clients and contracts (sprint 031-CL): add, edit, archive, unarchive,
 * remove. They call the same `/api/*` routes the admin pages' rules live behind; `remove` asks
 * first (see `lib/confirm.mjs`) and prints what the server moved to Deleted Client.
 */

import { UsageError } from '../lib/args.mjs';
import { confirmRemoval } from '../lib/confirm.mjs';
import { formatMinutes } from '../lib/dates.mjs';
import { describeClient, describeContract } from '../lib/resolve.mjs';
import { findClient, findContract } from '../lib/object-refs.mjs';

const CLEAR_WORDS = new Set(['none', '-', '']);

function parseColor(flags) {
	if (flags.color === undefined) return undefined;
	const colorIndex = Number(flags.color);
	if (!Number.isInteger(colorIndex) || colorIndex < 0 || colorIndex > 7) throw new UsageError('--color must be a palette index from 0 to 7.');
	return colorIndex;
}

function clearable(value) {
	return CLEAR_WORDS.has(String(value).trim().toLowerCase()) ? null : String(value);
}

/** e.g. "3 time entries (4h30m) and 2 notes" or "no time entries or notes". */
export function describeUsage(usage) {
	const parts = [];
	if (usage.timeEntryCount) parts.push(`${usage.timeEntryCount} time ${usage.timeEntryCount === 1 ? 'entry' : 'entries'} (${formatMinutes(usage.totalMinutes)})`);
	if (usage.noteCount) parts.push(`${usage.noteCount} ${usage.noteCount === 1 ? 'note' : 'notes'}`);
	return parts.join(' and ') || 'no time entries or notes';
}

// ── clients ─────────────────────────────────────────────────────────

export async function clientAdd({ api, print, positionals, flags }) {
	const name = positionals.join(' ').trim();
	if (!name || !flags.code) throw new UsageError('Usage: chronolog client add "<name>" --code <SHORT> [--emoji X] [--color 0-7]');
	const body = { name, shortCode: String(flags.code) };
	if (flags.emoji !== undefined) body.emoji = clearable(flags.emoji);
	const colorIndex = parseColor(flags);
	if (colorIndex !== undefined) body.colorIndex = colorIndex;
	const { client } = await api.post('/api/clients', body);
	print(`Created client ${describeClient(client)}`, client);
}

export async function clientEdit({ api, print, positionals, flags }) {
	const reference = positionals.join(' ');
	const usage = 'Usage: chronolog client edit <client> [--name "..."] [--code SHORT] [--emoji X|none] [--color 0-7] [--order N]';
	if (!reference) throw new UsageError(usage);
	const body = {};
	if (flags.name !== undefined) body.name = String(flags.name);
	if (flags.code !== undefined) body.shortCode = String(flags.code);
	if (flags.emoji !== undefined) body.emoji = clearable(flags.emoji);
	const colorIndex = parseColor(flags);
	if (colorIndex !== undefined) body.colorIndex = colorIndex;
	// --order N: the client's place in the app's sidebar, 1 = top (sprint 039-CL)
	if (flags.order !== undefined) {
		const position = Number(flags.order);
		if (!Number.isInteger(position) || position < 1) throw new UsageError('--order must be a whole number, 1 or more (1 = top of the sidebar).');
		body.position = position;
	}
	if (Object.keys(body).length === 0) throw new UsageError(`Nothing to change. ${usage}`);

	const client = await findClient(api, reference);
	const result = await api.patch(`/api/clients/${client.id}`, body);
	const ordered = result.position !== undefined ? `, number ${result.position} in the sidebar` : '';
	print(`Saved client ${describeClient(result.client)}${ordered}`, { ...result.client, ...(result.position !== undefined ? { position: result.position } : {}) });
}

function clientArchiver(archived) {
	return async ({ api, print, positionals }) => {
		const reference = positionals.join(' ');
		if (!reference) throw new UsageError(`Usage: chronolog client ${archived ? 'archive' : 'unarchive'} <client>`);
		const client = await findClient(api, reference);
		const result = await api.patch(`/api/clients/${client.id}`, { archived });
		print(result.message, result.client);
	};
}

export const clientArchive = clientArchiver(true);
export const clientUnarchive = clientArchiver(false);

export async function clientRemove({ api, print, positionals, flags, stdin }) {
	const reference = positionals.join(' ');
	if (!reference) throw new UsageError('Usage: chronolog client remove <client> [--yes]');
	const found = await findClient(api, reference);
	const { usage } = await api.get(`/api/clients/${found.id}`);
	await confirmRemoval({
		flags,
		stdin,
		summary: `Client ${found.shortCode} “${found.name}” has ${describeUsage(usage)}; removing it moves them to Deleted Client / Deleted Contract and deletes all its contracts, deliverables and work types.`
	});
	const result = await api.delete(`/api/clients/${found.id}`);
	print(result.message, result);
}

// ── contracts ───────────────────────────────────────────────────────

export async function contractAdd({ api, print, positionals, flags }) {
	const [clientReference, ...nameWords] = positionals;
	const name = nameWords.join(' ').trim();
	if (!clientReference || !name) throw new UsageError('Usage: chronolog contract add <client> "<name>" [--description "..."] [--inactive]');
	const client = await findClient(api, clientReference);
	const body = { clientId: client.id, name, isActive: !flags.inactive };
	if (flags.description !== undefined) body.description = clearable(flags.description);
	const { contract } = await api.post('/api/contracts', body);
	const row = { ...contract, clientName: client.name, clientShortCode: client.shortCode };
	print(`Created contract ${describeContract(row)}`, row);
}

export async function contractEdit({ api, print, positionals, flags }) {
	const reference = positionals.join(' ');
	const usage = 'Usage: chronolog contract edit <contract> [--name "..."] [--description "..."|none] [--active | --inactive]';
	if (!reference) throw new UsageError(usage);
	const body = {};
	if (flags.name !== undefined) body.name = String(flags.name);
	if (flags.description !== undefined) body.description = clearable(flags.description);
	if (flags.active !== undefined) body.isActive = Boolean(flags.active);
	if (flags.inactive !== undefined) body.isActive = !flags.inactive;
	if (Object.keys(body).length === 0) throw new UsageError(`Nothing to change. ${usage}`);

	const found = await findContract(api, reference);
	const { contract } = await api.patch(`/api/contracts/${found.id}`, body);
	const row = { ...found, ...contract };
	print(`Saved contract ${describeContract(row)}`, row);
}

function contractArchiver(archived) {
	return async ({ api, print, positionals }) => {
		const reference = positionals.join(' ');
		if (!reference) throw new UsageError(`Usage: chronolog contract ${archived ? 'archive' : 'unarchive'} <contract>`);
		const found = await findContract(api, reference);
		const result = await api.patch(`/api/contracts/${found.id}`, { archived });
		print(result.message, { ...found, ...result.contract });
	};
}

export const contractArchive = contractArchiver(true);
export const contractUnarchive = contractArchiver(false);

export async function contractRemove({ api, print, positionals, flags, stdin }) {
	const reference = positionals.join(' ');
	if (!reference) throw new UsageError('Usage: chronolog contract remove <contract> [--yes]');
	const found = await findContract(api, reference);
	const { usage } = await api.get(`/api/contracts/${found.id}`);
	await confirmRemoval({
		flags,
		stdin,
		summary: `Contract ${found.clientShortCode}/${found.name} has ${describeUsage(usage)}; removing it moves them to Deleted Client / Deleted Contract and deletes its deliverables and work types.`
	});
	const result = await api.delete(`/api/contracts/${found.id}`);
	print(result.message, result);
}
