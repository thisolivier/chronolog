/** Read-only commands: me, clients, contracts, week, notes, note show, search. */

import { describeClient, describeContract, resolveClient, resolveContract } from '../lib/resolve.mjs';
import { formatMinutes, isoWeekRange, parseIsoWeek, weekdayName } from '../lib/dates.mjs';
import { UsageError } from '../lib/args.mjs';
import { CLI_VERSION } from '../lib/version.mjs';

export async function fetchContracts(api) {
	return (await api.get('/api/contracts-by-client')).contracts;
}

export async function me({ api, print, config }) {
	const result = await api.get('/api/me');
	print(
		`${result.user.name} <${result.user.email}> via ${result.authenticatedBy}\n` +
			`Today ${result.today} (${result.timezone}), week ${result.isoWeek}: ${result.weekStart} to ${result.weekEnd}\n` +
			`Server ${result.serverVersion ?? 'unknown (older than 1.0.0)'} at ${config?.baseUrl ?? '?'}, CLI ${CLI_VERSION}`,
		{ ...result, cliVersion: CLI_VERSION }
	);
}

export async function clients({ api, print, flags }) {
	const { clients: clientList } = await api.get(`/api/clients${flags.all ? '?includeArchived=true' : ''}`);
	print(clientList.map((client) => describeClient({ ...client, shortCode: client.shortCode.padEnd(8) })).join('\n') || 'No clients.', clientList);
}

export async function contracts({ api, print, positionals, flags }) {
	const archivedQuery = flags.all ? '?includeArchived=true' : '';
	let contractList = (await api.get(`/api/contracts-by-client${archivedQuery}`)).contracts;
	const clientReference = positionals.join(' ');
	if (clientReference) {
		const { clients: clientList } = await api.get(`/api/clients${archivedQuery}`);
		const client = resolveClient(clientReference, clientList);
		contractList = contractList.filter((contract) => contract.clientId === client.id);
	}
	print(contractList.map(describeContract).join('\n') || 'No contracts.', contractList);
}

export async function week({ api, print, positionals, flags }) {
	let weekKey = positionals[0];
	if (!weekKey || weekKey === 'current' || weekKey === 'this') weekKey = (await api.get('/api/me')).isoWeek;
	const parsedWeek = parseIsoWeek(weekKey);
	if (!parsedWeek) throw new UsageError(`Week must look like 2026-W45, not “${weekKey}”.`);
	const { from, to } = isoWeekRange(parsedWeek.year, parsedWeek.weekNumber);

	let query = `/api/time-entries?from=${from}&to=${to}`;
	let scope = '';
	if (flags.contract) {
		const contract = resolveContract(flags.contract, await fetchContracts(api));
		query += `&contractId=${contract.id}`;
		scope = ` for ${contract.clientShortCode}/${contract.name}`;
	}
	const range = await api.get(query);
	let entries = range.entries;
	if (flags.client) {
		const client = resolveClient(flags.client, (await api.get('/api/clients')).clients);
		entries = entries.filter((entry) => entry.clientId === client.id);
		scope = ` for ${client.name}`;
	}
	const statuses = (await api.get(`/api/time-entries/weekly-statuses?weeks=${parsedWeek.key}`)).statuses;
	const status = statuses[parsedWeek.key] ?? 'Unsubmitted';
	const totalMinutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);

	const lines = [`Week ${parsedWeek.key} (${from} to ${to})${scope}: ${formatMinutes(totalMinutes)}, status ${status}`];
	let currentDate = '';
	for (const entry of entries) {
		if (entry.date !== currentDate) {
			currentDate = entry.date;
			const dayMinutes = entries.filter((other) => other.date === currentDate).reduce((sum, other) => sum + other.durationMinutes, 0);
			lines.push(`\n${weekdayName(currentDate)} ${currentDate}  ${formatMinutes(dayMinutes)}`);
		}
		const deliverable = entry.deliverableName ? ` · ${entry.deliverableName}` : '';
		lines.push(`  ${formatMinutes(entry.durationMinutes).padStart(6)}  ${entry.clientShortCode}/${entry.contractName}${deliverable}  ${entry.description ?? ''}`.trimEnd());
	}
	if (entries.length === 0) lines.push('No entries.');
	print(lines.join('\n'), { week: parsedWeek.key, from, to, status, totalMinutes, entries });
}

export async function notes({ api, print, positionals, flags }) {
	const reference = positionals.join(' ');
	if (!reference && !flags.since) throw new UsageError('Usage: chronolog notes <contract> [--since YYYY-MM-DD]');
	const params = new URLSearchParams();
	let contractLabel = 'all contracts';
	if (reference) {
		const contract = resolveContract(reference, await fetchContracts(api));
		params.set('contractId', contract.id);
		contractLabel = `${contract.clientShortCode}/${contract.name}`;
	}
	if (flags.since) params.set('updatedSince', flags.since);
	const { notes: noteList } = await api.get(`/api/notes?${params}`);
	const lines = noteList.map((note) => `${note.id}  ${String(note.updatedAt).slice(0, 10)}  ${note.displayTitle ?? note.firstLine ?? '(untitled)'}`);
	print([`Notes for ${contractLabel}: ${noteList.length}`, ...lines].join('\n'), noteList);
}

export async function noteShow({ api, print, positionals }) {
	const noteId = positionals[0];
	if (!noteId) throw new UsageError('Usage: chronolog note show <note-id>');
	const { note } = await api.get(`/api/notes/${encodeURIComponent(noteId)}`);
	const { timeEntries } = await api.get(`/api/notes/${encodeURIComponent(noteId)}/time-entries`);
	const linked = timeEntries.map((entry) => `  ${entry.date}  ${formatMinutes(entry.durationMinutes)}  ${entry.description ?? ''}`);
	const header = `${note.id}  ${note.title ?? '(untitled)'}\nUpdated ${note.updatedAt}`;
	const footer = linked.length ? `\n\nLinked time entries:\n${linked.join('\n')}` : '';
	print(`${header}\n\n${(note.content ?? '').trimEnd()}${footer}`, { ...note, timeEntries });
}

export async function search({ api, print, positionals, flags }) {
	const query = positionals.join(' ');
	if (!query) throw new UsageError('Usage: chronolog search "<words or note id>"');
	const limit = flags.limit ? `&limit=${encodeURIComponent(flags.limit)}` : '';
	const { notes: results } = await api.get(`/api/notes/search?q=${encodeURIComponent(query)}${limit}`);
	const lines = results.map((note) => `${note.id}  ${note.clientShortCode}/${note.contractName}  ${note.displayTitle ?? note.firstLine ?? ''}`);
	print(lines.join('\n') || 'No matching notes.', results);
}
