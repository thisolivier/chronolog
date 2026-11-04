/**
 * Turns the words a person uses ("acme retainer", "ACME/Website", a UUID) into exactly one
 * contract, client or deliverable, or fails with the candidates. It never picks between
 * several matches: an ambiguous or unknown reference is a `ReferenceError_` (exit code 3)
 * listing what matched, so the caller can ask the person.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ReferenceError_ extends Error {
	constructor(message, candidates = [], code = 'not_found') {
		super(message);
		this.candidates = candidates;
		this.code = code;
	}
}

function normalise(text) {
	return String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokens(text) {
	return normalise(text).split(/[\s/]+/).filter(Boolean);
}

/**
 * Generic matcher. `exactKeys(item)` lists strings that count as an exact match;
 * `haystack(item)` is searched for every word of the reference.
 */
export function resolveOne(reference, items, { kind, exactKeys, haystack, describe }) {
	const wanted = normalise(reference);
	if (!wanted) throw new ReferenceError_(`Name a ${kind}.`, [], 'missing');

	if (UUID_PATTERN.test(wanted)) {
		const byId = items.find((item) => item.id.toLowerCase() === wanted);
		if (byId) return byId;
		throw new ReferenceError_(`No ${kind} with id ${reference}.`);
	}

	const exact = items.filter((item) => exactKeys(item).some((key) => normalise(key) === wanted));
	if (exact.length === 1) return exact[0];
	if (exact.length > 1) {
		throw new ReferenceError_(`“${reference}” matches ${exact.length} ${kind}s exactly; use one of these ids.`, exact.map(describe), 'ambiguous');
	}

	const words = tokens(reference);
	const partial = items.filter((item) => {
		const text = normalise(haystack(item));
		return words.every((word) => text.includes(word));
	});
	if (partial.length === 1) return partial[0];
	if (partial.length === 0) {
		throw new ReferenceError_(`No ${kind} matches “${reference}”.`, items.map(describe), 'not_found');
	}
	throw new ReferenceError_(`“${reference}” matches ${partial.length} ${kind}s; be more specific or use an id.`, partial.map(describe), 'ambiguous');
}

export function describeContract(contract) {
	const inactive = contract.isActive === false ? ' [inactive]' : '';
	const archived = contract.archived || contract.clientArchived ? ' [archived]' : '';
	return `${contract.clientShortCode}/${contract.name} (${contract.clientName})${inactive}${archived}  id=${contract.id}`;
}

export function describeClient(client) {
	return `${client.shortCode} ${client.name}${client.archived ? ' [archived]' : ''}  id=${client.id}`;
}

/** `contracts` are rows from GET /api/contracts-by-client. */
export function resolveContract(reference, contracts) {
	return resolveOne(reference, contracts, {
		kind: 'contract',
		exactKeys: (contract) => [
			`${contract.clientShortCode}/${contract.name}`,
			`${contract.clientName}/${contract.name}`,
			`${contract.clientShortCode} ${contract.name}`,
			`${contract.clientName} ${contract.name}`
		],
		haystack: (contract) => `${contract.clientShortCode} ${contract.clientName} ${contract.name}`,
		describe: describeContract
	});
}

/** `clients` are rows from GET /api/clients. */
export function resolveClient(reference, clients) {
	return resolveOne(reference, clients, {
		kind: 'client',
		exactKeys: (client) => [client.shortCode, client.name],
		haystack: (client) => `${client.shortCode} ${client.name}`,
		describe: describeClient
	});
}

/** `deliverables` are rows from GET /api/deliverables?contractId=. */
export function resolveDeliverable(reference, deliverables) {
	return resolveOne(reference, deliverables, {
		kind: 'deliverable',
		exactKeys: (deliverable) => [deliverable.name],
		haystack: (deliverable) => deliverable.name,
		describe: (deliverable) => `${deliverable.name}  id=${deliverable.id}`
	});
}

/** `workTypes` are rows from GET /api/work-types?deliverableId=. */
export function resolveWorkType(reference, workTypes) {
	return resolveOne(reference, workTypes, {
		kind: 'work type',
		exactKeys: (workType) => [workType.name],
		haystack: (workType) => workType.name,
		describe: (workType) => `${workType.name}  id=${workType.id}`
	});
}

export function isUuid(text) {
	return UUID_PATTERN.test(String(text ?? '').trim());
}

/**
 * Splits a path reference `SHORTCODE/Contract/Deliverable/WorkType` into its contract part (the
 * first two segments) and the rest. `depth` is how many segments the object needs (3 for a
 * deliverable, 4 for a work type); fewer is a ReferenceError_ explaining the expected form.
 */
export function splitObjectPath(reference, depth, kind) {
	const segments = String(reference ?? '').split('/').map((segment) => segment.trim());
	if (segments.length < depth || segments.some((segment) => segment === '')) {
		const form = ['SHORTCODE', 'Contract', 'Deliverable', 'WorkType'].slice(0, depth).join('/');
		throw new ReferenceError_(`Name the ${kind} as ${form} or by id, not “${reference}”.`, [], 'missing');
	}
	return {
		contractReference: segments.slice(0, 2).join('/'),
		deliverableName: depth === 3 ? segments.slice(2).join('/') : segments[2],
		workTypeName: segments.slice(3).join('/')
	};
}
