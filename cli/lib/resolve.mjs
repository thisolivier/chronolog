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
	return `${contract.clientShortCode}/${contract.name} (${contract.clientName})${inactive}  id=${contract.id}`;
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
		describe: (client) => `${client.shortCode} ${client.name}  id=${client.id}`
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
