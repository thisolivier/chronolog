/** Commands that change data: log, note new, status. */

import { readFileSync } from 'node:fs';
import { resolveContract, resolveDeliverable } from '../lib/resolve.mjs';
import { formatMinutes, parseIsoWeek, resolveDateWord } from '../lib/dates.mjs';
import { UsageError } from '../lib/args.mjs';
import { fetchContracts } from './read.mjs';
import { recordLastEntry } from '../lib/history.mjs';

const WEEK_STATES = { unsubmitted: 'Unsubmitted', 'draft-ready': 'Draft ready', 'draft ready': 'Draft ready', draft: 'Draft ready', submitted: 'Submitted' };

export async function log({ api, print, positionals, flags, config, environment }) {
	const [contractReference, duration, ...descriptionWords] = positionals;
	if (!contractReference || !duration) {
		throw new UsageError('Usage: chronolog log <contract> <duration> "<description>" [--date] [--deliverable] [--note <id>]');
	}
	const contract = resolveContract(contractReference, await fetchContracts(api));

	const { today } = await api.get('/api/me');
	const date = flags.date ? resolveDateWord(flags.date, today) : today;
	if (!date) throw new UsageError(`--date must be YYYY-MM-DD, today, yesterday or a weekday name, not “${flags.date}”.`);

	const body = { contractId: contract.id, date, duration, description: descriptionWords.join(' ') || undefined };
	if (flags.deliverable) {
		const deliverables = await api.get(`/api/deliverables?contractId=${contract.id}`);
		body.deliverableId = resolveDeliverable(flags.deliverable, deliverables).id;
	}
	if (flags.note) body.noteId = flags.note;

	const { entry } = await api.post('/api/time-entries', body);
	const range = entry.startTime ? ` (${entry.startTime.slice(0, 5)}-${entry.endTime.slice(0, 5)})` : '';
	const summary = `${formatMinutes(entry.durationMinutes)}${range} on ${entry.date} to ${contract.clientShortCode}/${contract.name}: ${entry.description ?? ''}`;
	try {
		recordLastEntry({ entryId: entry.id, baseUrl: config?.baseUrl ?? null, createdAt: new Date().toISOString(), summary }, environment);
	} catch {
		// Undo is a convenience; an unwritable config directory must not fail the log
	}
	print(
		`Logged ${summary}\nid=${entry.id}`,
		{ ...entry, contractName: contract.name, clientShortCode: contract.clientShortCode }
	);
}

function readBody(flags, stdin) {
	if (flags.file) return readFileSync(flags.file, 'utf8');
	if (!stdin.isTTY) return readFileSync(0, 'utf8');
	return '';
}

export async function noteNew({ api, print, positionals, flags, stdin = process.stdin }) {
	const [contractReference, ...titleWords] = positionals;
	const title = titleWords.join(' ').trim();
	if (!contractReference || !title) {
		throw new UsageError('Usage: chronolog note new <contract> "<title>" [--file body.md]  (or pipe the body on stdin)');
	}
	const contract = resolveContract(contractReference, await fetchContracts(api));
	const markdownBody = readBody(flags, stdin).trim();
	const content = `# ${title}\n\n${markdownBody}`.trimEnd() + '\n';

	const { note } = await api.post('/api/notes', { contractId: contract.id, title, content });
	print(`Created note ${note.id} in ${contract.clientShortCode}/${contract.name}: ${title}`, note);
}

export async function status({ api, print, positionals }) {
	const [weekWord, ...stateWords] = positionals;
	const stateWord = stateWords.join(' ').toLowerCase();
	if (!weekWord || !stateWord) throw new UsageError('Usage: chronolog status <2026-W45|current> <unsubmitted|draft-ready|submitted>');
	const weekKey = weekWord === 'current' || weekWord === 'this' ? (await api.get('/api/me')).isoWeek : weekWord;
	const parsedWeek = parseIsoWeek(weekKey);
	if (!parsedWeek) throw new UsageError(`Week must look like 2026-W45, not “${weekWord}”.`);
	const state = WEEK_STATES[stateWord];
	if (!state) throw new UsageError('State must be unsubmitted, draft-ready or submitted.');

	const result = await api.post('/api/time-entries/weekly-statuses', { year: parsedWeek.year, weekNumber: parsedWeek.weekNumber, status: state });
	print(`Week ${parsedWeek.key} is now ${state}.`, result.status);
}
