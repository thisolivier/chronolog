/** `chronolog search <query> [--limit N] [--json]`: notes and time entries (sprint 042-CL, GET /api/search). */

import { UsageError } from '../lib/args.mjs';
import { formatMinutes } from '../lib/dates.mjs';

const MINIMUM_QUERY_LENGTH = 2;

/** Snippet text with each match wrapped in »…« so it stands out in a terminal without colour. */
export function markMatches(snippet) {
	let marked = '';
	let position = 0;
	for (const match of snippet.matches ?? []) {
		if (match.start < position) continue;
		marked += `${snippet.text.slice(position, match.start)}»${snippet.text.slice(match.start, match.end)}«`;
		position = match.end;
	}
	return marked + snippet.text.slice(position);
}

function groupHeading(label, group) {
	const shown = group.hits.length;
	return shown < group.total ? `${label} (${shown} of ${group.total})` : `${label} (${group.total})`;
}

/** The human-readable listing: a Notes group and a Time entries group, each hit with its snippet. */
export function formatSearchResult(result) {
	const lines = [];
	lines.push(groupHeading('Notes', result.notes));
	for (const hit of result.notes.hits) {
		lines.push(`  ${hit.id}  ${hit.clientShortCode}/${hit.contractName}  ${String(hit.updatedAt).slice(0, 10)}  ${hit.title}`);
		if (hit.snippet.text) lines.push(`      ${markMatches(hit.snippet)}`);
	}
	lines.push('', groupHeading('Time entries', result.timeEntries));
	for (const hit of result.timeEntries.hits) {
		lines.push(
			`  ${hit.date}  ${formatMinutes(hit.durationMinutes).padStart(6)}  ${hit.clientShortCode}/${hit.contractName}  ${markMatches(hit.snippet)}  (${hit.id})`
		);
	}
	return lines.join('\n');
}

export async function search({ api, print, positionals, flags }) {
	const query = positionals.join(' ').trim();
	if (query.length < MINIMUM_QUERY_LENGTH) {
		throw new UsageError('Usage: chronolog search "<words or note id>" [--limit N]   (at least 2 characters)');
	}
	const limit = flags.limit ? `&limit=${encodeURIComponent(flags.limit)}` : '';
	const result = await api.get(`/api/search?q=${encodeURIComponent(query)}${limit}`);
	const isEmpty = result.notes.total === 0 && result.timeEntries.total === 0;
	print(isEmpty ? `Nothing matches "${query}".` : formatSearchResult(result), result);
}
