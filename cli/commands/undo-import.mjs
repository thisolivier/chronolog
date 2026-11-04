/**
 * `chronolog undo --last-import` (038-CL, notes since 044-CL): undoes the last
 * `chronolog import`. Entries it created are deleted; notes it created go to the trash
 * (restorable for 30 days with `note restore`); notes it updated are left as they are.
 * One confirmation for the whole batch (`--yes` without a terminal).
 */

import { basename } from 'node:path';
import { UsageError } from '../lib/args.mjs';
import { clearLastImport, readLastImport } from '../lib/import-history.mjs';
import { confirmRemoval } from '../lib/confirm.mjs';
import { notePath } from '../lib/note-fetch.mjs';

const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`;

/** Remove each id with `removeOne`; a 404 counts as already gone. */
async function removeAll(ids, removeOne) {
	let removed = 0;
	let alreadyGone = 0;
	for (const id of ids) {
		try {
			await removeOne(id);
			removed += 1;
		} catch (failure) {
			if (failure.status !== 404) throw failure;
			alreadyGone += 1;
		}
	}
	return { removed, alreadyGone };
}

export async function undoLastImport({ api, print, flags, config, environment }) {
	const record = readLastImport(environment);
	if (!record) throw new UsageError('Nothing to undo: this CLI has no record of an import.');
	if (record.baseUrl && config.baseUrl && record.baseUrl !== config.baseUrl) {
		throw new UsageError(`The last import went to ${record.baseUrl}, not ${config.baseUrl}; nothing undone.`);
	}
	const fileName = basename(record.file ?? 'file');
	const isNotes = record.noteIds.length > 0;
	const ids = isNotes ? record.noteIds : record.entryIds;
	const what = isNotes ? plural(ids.length, 'note', 'notes') : plural(ids.length, 'time entry', 'time entries');
	await confirmRemoval({
		flags,
		summary: `The last import (${fileName}, ${record.createdAt}) created ${what}.`,
		question: isNotes ? 'Move them all to the trash?' : 'Delete them all?',
		refusal: 'Not deleted: confirm with the owner, then run again with --yes.'
	});

	const removeOne = isNotes ? (noteId) => api.delete(notePath(noteId)) : (entryId) => api.delete(`/api/time-entries/${entryId}`);
	const { removed, alreadyGone } = await removeAll(ids, removeOne);
	clearLastImport(environment);
	const gone = alreadyGone ? ` (${alreadyGone} were already gone)` : '';
	if (isNotes) {
		print(
			`Moved ${plural(removed, 'note', 'notes')} from the import of ${fileName} to the trash${gone}.\nRestore one with \`chronolog note restore <note-id>\` within 30 days.`,
			{ trashed: removed, alreadyGone, noteIds: ids, file: record.file ?? null }
		);
	} else {
		print(`Deleted ${removed} time entries from the import of ${fileName}${gone}.`, { deleted: removed, alreadyGone, file: record.file ?? null });
	}
}
