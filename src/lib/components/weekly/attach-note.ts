/**
 * "Attach note" on a time entry (sprint 049-UI): make a new note on the entry's contract, put a
 * `[[NOTE_ID]]` wiki-link to it at the end of the entry's description (the form the `[[`
 * autocomplete inserts) and save the entry. The server then lists the entry under the note's
 * Linked Time Entries. Both writes go through the data service, so offline they queue in the
 * outbox (the entry edit waits for the note's create and gets its real ID on replay).
 */
import type { DataService } from '$lib/services/data-service';
import { FORMERLY_LINE_PATTERN } from './formerly-lines';

/**
 * The description with `[[noteId]]` added at the end of its text, after a space. "Formerly: …"
 * lines stay last (the card shows them apart), so the link joins the last line before them.
 * A description that already links the note is returned unchanged.
 */
export function appendWikiLinkToDescription(description: string | null | undefined, noteId: string): string {
	const reference = `[[${noteId}]]`;
	const text = description ?? '';
	if (text.includes(reference)) return text;
	const lines = text.split(/\r?\n/);
	let firstFormerlyIndex = lines.length;
	while (firstFormerlyIndex > 0 && FORMERLY_LINE_PATTERN.test(lines[firstFormerlyIndex - 1])) firstFormerlyIndex--;
	const bodyLines = lines.slice(0, firstFormerlyIndex);
	const formerlyLines = lines.slice(firstFormerlyIndex);
	const bodyText = bodyLines.join('\n').trimEnd();
	const linkedBody = bodyText ? `${bodyText} ${reference}` : reference;
	return [linkedBody, ...formerlyLines].join('\n');
}

/** Why an entry cannot have a note attached, or null when it can (a note needs a contract) */
export function attachNoteBlockedReason(contractId: string | null | undefined): string | null {
	return contractId ? null : 'Pick a contract for this entry first: a note belongs to a contract';
}

export type AttachNoteRequest = {
	entryId: string;
	contractId: string;
	/** The description to add the link to (the open editor's text when it is open) */
	description: string | null | undefined;
};

/** Create the note (empty, as the New Note draft starts) and link it from the entry */
export async function attachNewNoteToEntry(
	dataService: Pick<DataService, 'createNote' | 'updateTimeEntry'>,
	request: AttachNoteRequest
): Promise<{ noteId: string; description: string }> {
	const note = await dataService.createNote(request.contractId, {});
	const description = appendWikiLinkToDescription(request.description, note.id);
	await dataService.updateTimeEntry(request.entryId, { description });
	return { noteId: note.id, description };
}
