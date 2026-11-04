/**
 * `chronolog import notes|entries <file>` and `chronolog undo --last-import` (sprint 038-CL).
 *
 * The file (JSON Lines or a JSON array, see lib/import-file.mjs) uses the CLI's references; they
 * are resolved once each (lib/import-items.mjs). Any unknown or ambiguous reference refuses the
 * whole file before anything is sent (exit 3, listing the lines). Then the items go to
 * `POST /api/notes/batch` in chunks of 100 or `POST /api/time-entries/batch` in chunks of 200
 * (`--atomic` per chunk). One line per item, then a summary; exit 1 if any item failed.
 * Created entries are remembered so `undo --last-import` can delete them all (confirmed).
 */

import { readFileSync } from 'node:fs';
import { basename, resolve as resolvePath } from 'node:path';
import { UsageError } from '../lib/args.mjs';
import { ReferenceError_ } from '../lib/resolve.mjs';
import { chunk, parseImportText } from '../lib/import-file.mjs';
import { createReferenceLookups, resolveImportItems } from '../lib/import-items.mjs';
import { clearLastImport, readLastImport, recordLastImport } from '../lib/import-history.mjs';
import { confirmRemoval } from '../lib/confirm.mjs';
import * as correct from './correct.mjs';

const KINDS = {
	notes: { path: '/api/notes/batch', chunkSize: 100, noun: 'notes' },
	entries: { path: '/api/time-entries/batch', chunkSize: 200, noun: 'time entries' }
};
const KIND_ALIASES = { note: 'notes', notes: 'notes', entry: 'entries', entries: 'entries', 'time-entries': 'entries' };
const USAGE = 'Usage: chronolog import notes|entries <file.jsonl|file.json> [--dry-run] [--atomic] [--json]';
const MAX_CANDIDATES_SHOWN = 5;

export class ImportFailed extends Error {}

function refuseFile(problems, filePath) {
	const lines = problems
		.sort((left, right) => left.line - right.line)
		.flatMap((problem) => [
			`line ${problem.line}: ${problem.message}`,
			...problem.candidates.slice(0, MAX_CANDIDATES_SHOWN).map((candidate) => `    ${candidate}`)
		]);
	const message = `${problems.length} line${problems.length > 1 ? 's' : ''} of ${basename(filePath)} cannot be imported; nothing was sent. Fix them and run again.`;
	const failure = problems.some((problem) => problem.isReference) ? new ReferenceError_(message, lines, 'bad_references') : new UsageError(message);
	failure.candidates = lines;
	return failure;
}

async function sendChunks(api, kind, payloads, atomic) {
	const outcomes = [];
	for (const group of chunk(payloads, KINDS[kind].chunkSize)) {
		const response = await api.post(KINDS[kind].path, { items: group.map((payload) => payload.body), ...(atomic ? { atomic: true } : {}) });
		for (const result of response.results) outcomes.push({ ...result, line: group[result.index].line, label: group[result.index].label, action: group[result.index].action });
	}
	return outcomes;
}

function outcomeLine(outcome) {
	if (!outcome.ok) return `fail ${outcome.line} ${outcome.code} ${outcome.error}`;
	const note = outcome.action === 'update' ? ` (updated${outcome.unconditional ? ', unconditionally' : ''})` : '';
	return `ok ${outcome.line} ${outcome.id}${note}  ${outcome.label}`;
}

export async function importFile({ api, print, positionals, flags, config, environment }) {
	const [kindWord, filePath] = positionals;
	const kind = KIND_ALIASES[kindWord];
	if (!kind || !filePath) throw new UsageError(USAGE);

	let text;
	try {
		text = readFileSync(filePath, 'utf8');
	} catch (failure) {
		throw new UsageError(`Cannot read ${filePath}: ${failure.code ?? failure.message}`);
	}
	const parsed = parseImportText(text);
	if (parsed.items.length === 0 && parsed.problems.length === 0) throw new UsageError(`${filePath} has no items.`);

	const { today } = await api.get('/api/me');
	const resolved = await resolveImportItems(kind, parsed.items, createReferenceLookups(api), today);
	const problems = [...parsed.problems, ...resolved.problems];
	if (problems.length) throw refuseFile(problems, filePath);

	const { payloads } = resolved;
	const requestCount = Math.ceil(payloads.length / KINDS[kind].chunkSize);
	if (flags.dryRun) {
		print(
			[
				...payloads.map((payload) => `would ${payload.action} ${payload.line}  ${payload.label}\n    ${JSON.stringify(payload.body)}`),
				`Dry run: ${payloads.length} ${KINDS[kind].noun} in ${requestCount} request${requestCount > 1 ? 's' : ''}${flags.atomic ? ' (atomic)' : ''}; nothing sent.`
			].join('\n'),
			{ dryRun: true, kind, file: filePath, requests: requestCount, atomic: Boolean(flags.atomic), items: payloads.map(({ line, action, body }) => ({ line, action, body })) }
		);
		return;
	}

	let outcomes = [];
	try {
		outcomes = await sendChunks(api, kind, payloads, Boolean(flags.atomic));
	} finally {
		const entryIds = kind === 'entries' ? outcomes.filter((outcome) => outcome.ok).map((outcome) => outcome.id) : [];
		if (entryIds.length) {
			try {
				recordLastImport({ entryIds, baseUrl: config?.baseUrl ?? null, createdAt: new Date().toISOString(), file: resolvePath(filePath) }, environment);
			} catch {
				// Undo is a convenience; an unwritable config directory must not fail the import
			}
		}
	}

	const created = outcomes.filter((outcome) => outcome.ok && outcome.action === 'create').length;
	const updated = outcomes.filter((outcome) => outcome.ok && outcome.action === 'update').length;
	const failed = outcomes.filter((outcome) => !outcome.ok).length;
	const summary = `Imported ${created + updated} of ${outcomes.length} ${KINDS[kind].noun} from ${basename(filePath)}: ${created} created, ${updated} updated, ${failed} failed.`;
	print([...outcomes.map(outcomeLine), summary].join('\n'), {
		kind,
		file: filePath,
		created,
		updated,
		failed,
		results: outcomes.map(({ label: _label, action: _action, ...result }) => result)
	});
	if (failed) {
		const failedLines = outcomes.filter((outcome) => !outcome.ok).map((outcome) => outcome.line);
		throw new ImportFailed(`${failed} of ${outcomes.length} items failed (line${failed > 1 ? 's' : ''} ${failedLines.join(', ')}); the others are saved.`);
	}
}

/** `undo` deletes the last logged entry; `undo --last-import` the entries of the last import. */
export async function undo(context) {
	if (!context.flags.lastImport) return correct.undo(context);
	const { api, print, flags, config, environment } = context;
	const record = readLastImport(environment);
	if (!record) throw new UsageError('Nothing to undo: this CLI has no record of an entries import.');
	if (record.baseUrl && config.baseUrl && record.baseUrl !== config.baseUrl) {
		throw new UsageError(`The last import went to ${record.baseUrl}, not ${config.baseUrl}; nothing undone.`);
	}
	const count = record.entryIds.length;
	await confirmRemoval({
		flags,
		summary: `The last import (${basename(record.file ?? 'file')}, ${record.createdAt}) created ${count} time entr${count === 1 ? 'y' : 'ies'}.`,
		question: 'Delete them all?',
		refusal: 'Not deleted: confirm with the owner, then run again with --yes.'
	});

	let deleted = 0;
	let alreadyGone = 0;
	for (const entryId of record.entryIds) {
		try {
			await api.delete(`/api/time-entries/${entryId}`);
			deleted += 1;
		} catch (failure) {
			if (failure.status !== 404) throw failure;
			alreadyGone += 1;
		}
	}
	clearLastImport(environment);
	const gone = alreadyGone ? ` (${alreadyGone} were already gone)` : '';
	print(`Deleted ${deleted} time entries from the import of ${basename(record.file ?? 'file')}${gone}.`, { deleted, alreadyGone, file: record.file ?? null });
}
