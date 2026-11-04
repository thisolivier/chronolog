/**
 * `chronolog todos [contract] [--all] [--json]` (sprint 040-CL): open checkbox items (`- [ ]`) across
 * the user's notes, from `GET /api/notes/todos`, which reads them from each note's markdown on the
 * server (one request; the CLI would otherwise fetch every note). `--all` adds done items.
 * One line per item (note id, note title, the item), grouped by note, a blank line between notes.
 */

import { resolveContract } from '../lib/resolve.mjs';
import { fetchContracts } from './read.mjs';

/** The text lines for a todos response; pure, for tests. */
export function formatTodos(response, { includeDone, scopeLabel, contractLabels = new Map() }) {
	const itemCount = response.openCount + (includeDone ? response.doneCount : 0);
	const kind = includeDone ? `${response.openCount} open, ${response.doneCount} done` : `${response.openCount} open`;
	const header = `Todos for ${scopeLabel}: ${kind} in ${response.notes.length} note${response.notes.length === 1 ? '' : 's'}`;
	if (itemCount === 0) return [header, includeDone ? 'No checkbox items.' : 'No open items.'].join('\n');

	const blocks = response.notes.map((note) => {
		const contractLabel = contractLabels.get(note.contractId);
		const title = `${note.title ?? '(untitled)'}${contractLabel ? ` (${contractLabel})` : ''}`;
		return note.items
			.map((item) => {
				const box = includeDone ? (item.checked ? '[x] ' : '[ ] ') : '';
				return `${note.id}  ${title}  ${'  '.repeat(item.depth)}${box}${item.text}`;
			})
			.join('\n');
	});
	return [header, '', blocks.join('\n\n')].join('\n');
}

export async function todos({ api, print, positionals, flags }) {
	const includeDone = Boolean(flags.all);
	const params = new URLSearchParams();
	const contracts = await fetchContracts(api);
	const reference = positionals.join(' ');
	let scopeLabel = 'all contracts';
	if (reference) {
		const contract = resolveContract(reference, contracts);
		params.set('contractId', contract.id);
		scopeLabel = `${contract.clientShortCode}/${contract.name}`;
	}
	if (includeDone) params.set('all', '1');

	const response = await api.get(`/api/notes/todos${params.size ? `?${params}` : ''}`);
	const contractLabels = new Map(contracts.map((contract) => [contract.id, `${contract.clientShortCode}/${contract.name}`]));
	// one contract asked for: its name is in the header, not on every line
	const labelsPerLine = reference ? new Map() : contractLabels;
	const notesWithContracts = response.notes.map((note) => ({ ...note, contract: contractLabels.get(note.contractId) ?? null }));
	print(formatTodos(response, { includeDone, scopeLabel, contractLabels: labelsPerLine }), { ...response, notes: notesWithContracts });
}
