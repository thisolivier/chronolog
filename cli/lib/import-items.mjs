/**
 * Turns the items of a `chronolog import` file (human references) into batch API items (ids),
 * sprint 038-CL. Each distinct reference is looked up once: one contracts call, one deliverables
 * call per contract touched, one work-types call per deliverable touched. Nothing is guessed: an
 * unknown or ambiguous reference is a problem for that line (with the candidates), and the caller
 * refuses the whole file.
 *
 * Note items: a new note `{ contract, title?, body? | content?, date? }` (`body` gets a `# title`
 * heading as `note new` does; `content` is used as given) or a change `{ id, title?, content? |
 * append?, expectedUpdatedAt? }`. Entry items: `{ contract, date, duration | startTime+endTime,
 * description?, deliverable?, workType?, note? }`.
 */

import { ReferenceError_, resolveContract, resolveDeliverable, resolveWorkType } from './resolve.mjs';
import { resolveDateWord } from './dates.mjs';

const NOTE_CREATE_FIELDS = new Set(['contract', 'title', 'body', 'content', 'date']);
const NOTE_UPDATE_FIELDS = new Set(['id', 'title', 'content', 'append', 'expectedUpdatedAt']);
const ENTRY_FIELDS = new Set(['contract', 'date', 'duration', 'startTime', 'endTime', 'description', 'deliverable', 'workType', 'note']);

class ItemProblem extends Error {}

/** Cached lookups against the API: each list is fetched at most once. */
export function createReferenceLookups(api) {
	const cache = new Map();
	const once = (key, load) => {
		if (!cache.has(key)) cache.set(key, load());
		return cache.get(key);
	};
	return {
		contracts: () => once('contracts', async () => (await api.get('/api/contracts-by-client')).contracts),
		deliverables: (contractId) => once(`deliverables:${contractId}`, () => api.get(`/api/deliverables?contractId=${contractId}`)),
		workTypes: (deliverableId) => once(`work-types:${deliverableId}`, () => api.get(`/api/work-types?deliverableId=${deliverableId}`))
	};
}

/** Resolves a reference once per distinct (scope, text); a failure is remembered too. */
function memoised() {
	const results = new Map();
	return async (key, resolve) => {
		if (!results.has(key)) {
			results.set(key, resolve().then((value) => ({ value }), (failure) => ({ failure })));
		}
		const outcome = await results.get(key);
		if (outcome.failure) throw outcome.failure;
		return outcome.value;
	};
}

function checkFields(value, allowed, kind) {
	const unknown = Object.keys(value).filter((key) => !allowed.has(key));
	if (unknown.length) throw new ItemProblem(`unknown field${unknown.length > 1 ? 's' : ''} for ${kind}: ${unknown.join(', ')} (allowed: ${[...allowed].join(', ')})`);
}

function text(value, fieldName) {
	if (value === undefined || value === null) return undefined;
	if (typeof value !== 'string') throw new ItemProblem(`${fieldName} must be text`);
	return value;
}

function dateFor(value, today) {
	if (value === undefined || value === null) return undefined;
	// A word the CLI does not know goes to the server as written, which reports invalid_date for that item
	return resolveDateWord(String(value), today) ?? String(value);
}

function noteContent(title, body, content) {
	if (content !== undefined) {
		if (body !== undefined) throw new ItemProblem('give body (a heading is added from the title) or content (used as written), not both');
		return content;
	}
	if (body === undefined) return title ? `# ${title}\n` : undefined;
	return title ? `# ${title}\n\n${body.trim()}`.trimEnd() + '\n' : body;
}

function createResolvers(lookups) {
	const remember = memoised();
	const contract = (reference) => remember(`contract:${reference}`, async () => resolveContract(reference, await lookups.contracts()));
	const deliverable = (contractRow, reference) =>
		remember(`deliverable:${contractRow.id}:${reference}`, async () => resolveDeliverable(reference, await lookups.deliverables(contractRow.id)));
	const workType = (deliverableRow, reference) =>
		remember(`work-type:${deliverableRow.id}:${reference}`, async () => {
			try {
				return resolveWorkType(reference, await lookups.workTypes(deliverableRow.id));
			} catch (failure) {
				if (failure instanceof ReferenceError_ && failure.code === 'not_found') {
					failure.message = `No work type matches “${reference}” under deliverable “${deliverableRow.name}”.`;
				}
				throw failure;
			}
		});
	return { contract, deliverable, workType };
}

async function noteItem(value, resolvers, today) {
	if (value.id !== undefined) {
		checkFields(value, NOTE_UPDATE_FIELDS, 'a note change');
		const body = { id: text(value.id, 'id') };
		for (const fieldName of ['title', 'content', 'append', 'expectedUpdatedAt']) {
			if (value[fieldName] !== undefined) body[fieldName] = value[fieldName] === null ? null : text(value[fieldName], fieldName);
		}
		return { body, label: body.id, action: 'update' };
	}
	checkFields(value, NOTE_CREATE_FIELDS, 'a new note');
	if (!value.contract) throw new ItemProblem('contract is required (or id, to change a note)');
	const contract = await resolvers.contract(String(value.contract));
	const title = text(value.title, 'title');
	const body = { contractId: contract.id };
	if (title !== undefined) body.title = title;
	const content = noteContent(title, text(value.body, 'body'), text(value.content, 'content'));
	if (content !== undefined) body.content = content;
	const createdAt = dateFor(value.date, today);
	if (createdAt) body.createdAt = createdAt;
	return { body, label: `${contract.clientShortCode}/${contract.name}${createdAt ? ` ${createdAt}` : ''}: ${title ?? '(untitled)'}`, action: 'create' };
}

async function entryItem(value, resolvers, today) {
	checkFields(value, ENTRY_FIELDS, 'a time entry');
	if (!value.contract) throw new ItemProblem('contract is required');
	if (value.workType && !value.deliverable) throw new ItemProblem('workType needs deliverable (work types belong to a deliverable)');
	const contract = await resolvers.contract(String(value.contract));
	const body = { contractId: contract.id };
	const date = dateFor(value.date, today);
	if (date) body.date = date;
	if (value.duration !== undefined && value.duration !== null) body.duration = String(value.duration);
	for (const fieldName of ['startTime', 'endTime', 'description']) {
		const fieldValue = text(value[fieldName], fieldName);
		if (fieldValue !== undefined) body[fieldName] = fieldValue;
	}
	if (value.deliverable) {
		const deliverable = await resolvers.deliverable(contract, String(value.deliverable));
		body.deliverableId = deliverable.id;
		if (value.workType) body.workTypeId = (await resolvers.workType(deliverable, String(value.workType))).id;
	}
	if (value.note) body.noteId = String(value.note);
	const amount = body.duration ?? (body.startTime && body.endTime ? `${body.startTime}-${body.endTime}` : '?');
	return { body, label: `${body.date ?? '?'} ${amount} ${contract.clientShortCode}/${contract.name}`, action: 'create' };
}

/**
 * `{ payloads: [{ line, body, label, action }], problems: [{ line, message, candidates, isReference }] }`
 * for `kind` 'notes' or 'entries'. `today` (YYYY-MM-DD) anchors date words.
 */
export async function resolveImportItems(kind, items, lookups, today) {
	const resolvers = createResolvers(lookups);
	const toPayload = kind === 'notes' ? noteItem : entryItem;
	const payloads = [];
	const problems = [];
	for (const { line, value } of items) {
		try {
			payloads.push({ line, ...(await toPayload(value, resolvers, today)) });
		} catch (failure) {
			if (failure instanceof ReferenceError_) {
				problems.push({ line, message: failure.message, candidates: failure.candidates ?? [], isReference: true });
			} else if (failure instanceof ItemProblem) {
				problems.push({ line, message: failure.message, candidates: [], isReference: false });
			} else {
				throw failure;
			}
		}
	}
	return { payloads, problems };
}
