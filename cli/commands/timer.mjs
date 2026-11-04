/**
 * The running timer from the command line (sprint 041-CL): `timer` (status), `timer start`,
 * `timer adjust`, `timer stop`. `--at` takes `HH:MM`, optionally after a date word
 * (`yesterday 23:10`, `2026-11-03 23:10`, `monday 9:00`). A start before the end of another
 * entry is a warning that needs a yes: on a terminal the person answers, otherwise `--yes`.
 */

import { createInterface } from 'node:readline';
import { UsageError } from '../lib/args.mjs';
import { formatMinutes, resolveDateWord } from '../lib/dates.mjs';
import { resolveContract } from '../lib/resolve.mjs';
import { fetchContracts } from './read.mjs';

const pad = (value) => String(value).padStart(2, '0');

/** The laptop's local date and time now. */
export function localNow(now = new Date()) {
	return {
		date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
		startTime: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
	};
}

/** `--at` → `{ date?, startTime }`; `date` only when a date word was given. Null when unreadable. */
export function parseAtFlag(value, today) {
	const match = String(value).trim().match(/^(?:(.+?)\s+)?(\d{1,2}):(\d{2})$/);
	if (!match) return null;
	const [, dateWord, hours, minutes] = match;
	if (Number(hours) > 23 || Number(minutes) > 59) return null;
	const startTime = `${pad(Number(hours))}:${minutes}:00`;
	if (!dateWord) return { startTime };
	const date = resolveDateWord(dateWord, today);
	return date ? { date, startTime } : null;
}

function readAt(flags, today) {
	const parsed = parseAtFlag(flags.at, today);
	if (!parsed) {
		throw new UsageError(`--at must be HH:MM, optionally after a date (yesterday 23:10, 2026-11-03 9:00), not “${flags.at}”.`);
	}
	return parsed;
}

function ask(question, stdin, stdout) {
	return new Promise((resolve) => {
		const prompt = createInterface({ input: stdin, output: stdout, terminal: true });
		prompt.question(question, (answer) => {
			prompt.close();
			resolve(answer.trim().toLowerCase());
		});
	});
}

export class StartNotChanged extends Error {}

/**
 * Send once; on `start_overlaps_entry` warn, then resend with `confirmed` after `--yes` or a "y"
 * on a terminal. Without a terminal and without `--yes`, refuse (exit 2).
 */
async function sendWithOverlapConfirm(send, { flags, stdin = process.stdin, stderr = process.stderr }) {
	try {
		return await send(false);
	} catch (failure) {
		if (failure?.code !== 'start_overlaps_entry') throw failure;
		stderr.write(`Warning: ${failure.message}\n`);
		if (!flags.yes) {
			if (!stdin.isTTY) throw new UsageError('Not changed: check with the owner, then run again with --yes to keep this start.');
			const answer = await ask('Keep this start? [y/N] ', stdin, stderr);
			if (answer !== 'y' && answer !== 'yes') throw new StartNotChanged('Start not changed.');
		}
		return send(true);
	}
}

function describeTimer(timer) {
	const contract = timer.clientShortCode ? `${timer.clientShortCode}/${timer.contractName}` : timer.contractName ?? '';
	return `${timer.date} ${String(timer.startTime ?? '').slice(0, 5)} ${contract}${timer.description ? `: ${timer.description}` : ''}`;
}

function elapsedMinutes(timer, now = new Date()) {
	const [year, month, day] = timer.date.split('-').map(Number);
	const [hours, minutes, seconds] = String(timer.startTime).split(':').map(Number);
	const started = new Date(year, month - 1, day, hours, minutes, seconds || 0);
	return Math.max(0, Math.floor((now.getTime() - started.getTime()) / 60_000));
}

export async function timerStatus({ api, print }) {
	const { timer } = await api.get('/api/timer/status');
	if (!timer) return print('No timer running.', { timer: null });
	if (timer.endTime) return print(`Stopped, not saved yet: ${describeTimer(timer)} (${formatMinutes(timer.durationMinutes)})`, { timer });
	print(`Running ${formatMinutes(elapsedMinutes(timer))} since ${describeTimer(timer)}\nid=${timer.id}`, { timer });
}

export async function timerStart({ api, print, positionals, flags, stdin, stderr }) {
	const [contractReference, ...descriptionWords] = positionals;
	if (!contractReference) throw new UsageError('Usage: chronolog timer start <contract> ["description"] [--at [date] HH:MM] [--yes]');
	const now = localNow();
	const start = flags.at ? { date: now.date, ...readAt(flags, now.date) } : now;
	const contract = resolveContract(contractReference, await fetchContracts(api));

	const timer = await sendWithOverlapConfirm(
		// Starting now never asks: nothing can have ended after now
		(confirmed) => api.post('/api/timer/start', { contractId: contract.id, ...start, confirmed: confirmed || !flags.at }),
		{ flags, stdin, stderr }
	);
	const description = descriptionWords.join(' ').trim();
	if (description) await api.put(`/api/time-entries/${timer.id}`, { description });
	print(
		`Timer started at ${timer.date} ${timer.startTime.slice(0, 5)} on ${contract.clientShortCode}/${contract.name}${description ? `: ${description}` : ''}\nid=${timer.id}`,
		{ ...timer, description: description || timer.description }
	);
}

export async function timerAdjust({ api, print, flags, stdin, stderr }) {
	if (!flags.at) throw new UsageError('Usage: chronolog timer adjust --at [date] HH:MM [--yes]');
	const start = readAt(flags, localNow().date);
	const timer = await sendWithOverlapConfirm(
		(confirmed) => api.patch('/api/timer', { ...start, confirmed }),
		{ flags, stdin, stderr }
	);
	print(`Timer now started at ${describeTimer(timer)} (${formatMinutes(elapsedMinutes(timer))} so far)`, timer);
}

/** Stop the running timer and save it as an entry on its contract. */
export async function timerStop({ api, print }) {
	const { timer } = await api.get('/api/timer/status');
	if (!timer) throw new UsageError('No timer running.');
	const stopped = timer.endTime ? timer : await api.post('/api/timer/stop', { endTime: localNow().startTime });
	const saved = await api.post('/api/timer/save', {
		entryId: timer.id,
		contractId: timer.contractId,
		deliverableId: timer.deliverableId,
		workTypeId: timer.workTypeId,
		description: timer.description
	});
	print(
		`Saved ${formatMinutes(stopped.durationMinutes)} (${timer.startTime.slice(0, 5)}-${String(stopped.endTime).slice(0, 5)}) on ${timer.date} to ${timer.clientShortCode}/${timer.contractName}${timer.description ? `: ${timer.description}` : ''}\nid=${timer.id}`,
		saved
	);
}

/** Wraps a command so a "no" at the overlap question prints and exits 0, like other refusals. */
export function catchNotChanged(command) {
	return async (context) => {
		try {
			await command(context);
		} catch (failure) {
			if (!(failure instanceof StartNotChanged)) throw failure;
			context.print(failure.message, { changed: false });
		}
	};
}
