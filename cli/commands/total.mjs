/**
 * `chronolog total` (sprint 065-TT): time recorded per contract for chosen contracts over a date
 * range, from `GET /api/time-entries/total`. Contracts: `--contract` (repeatable, never guessed),
 * `--client` (repeatable: all of that client's contracts) or `--all-contracts`. Range: `--from` /
 * `--to` (YYYY-MM-DD or a `--date` word; either alone is open-ended), `--all-time` for no bounds,
 * else the current week from `GET /api/me`.
 */

import { UsageError } from '../lib/args.mjs';
import { formatMinutes, resolveDateWord } from '../lib/dates.mjs';
import { resolveClient, resolveContract } from '../lib/resolve.mjs';
import { fetchContracts } from './read.mjs';

const USAGE = 'Usage: chronolog total --contract X... | --client X... | --all-contracts [--from D] [--to D] [--all-time]';

/** Every value given for a flag (repeatable), falling back to the single parsed value */
function valuesOf(flagValues, flags, name) {
	if (flagValues?.[name]?.length) return flagValues[name];
	return typeof flags[name] === 'string' ? [flags[name]] : [];
}

/** `{ from, to }` (null = open) from the flags; today and the current week come from `GET /api/me` */
export async function resolveRange(api, flags) {
	const hasBound = flags.from !== undefined || flags.to !== undefined;
	if (flags.allTime && hasBound) throw new UsageError('--all-time has no bounds; drop --from / --to, or --all-time.');
	if (flags.allTime) return { from: null, to: null };
	const me = await api.get('/api/me');
	if (!hasBound) return { from: me.weekStart, to: me.weekEnd };
	const resolveBound = (flagName) => {
		if (flags[flagName] === undefined) return null;
		const date = resolveDateWord(flags[flagName], me.today);
		if (!date) throw new UsageError(`--${flagName} must be YYYY-MM-DD, today, yesterday or a weekday, not “${flags[flagName]}”.`);
		return date;
	};
	const range = { from: resolveBound('from'), to: resolveBound('to') };
	if (range.from && range.to && range.from > range.to) throw new UsageError(`--from ${range.from} is after --to ${range.to}.`);
	return range;
}

/** `'all'`, or the contracts named by `--contract` and `--client` (deduplicated, in order) */
export async function resolveContractSelection(api, flags, flagValues) {
	if (flags.allContracts) return 'all';
	const contractReferences = valuesOf(flagValues, flags, 'contract');
	const clientReferences = valuesOf(flagValues, flags, 'client');
	if (contractReferences.length === 0 && clientReferences.length === 0) {
		throw new UsageError(`Name the contracts: --contract X, --client X or --all-contracts.\n${USAGE}`);
	}
	const contractList = await fetchContracts(api);
	const selected = new Map();
	for (const reference of contractReferences) {
		const contract = resolveContract(reference, contractList);
		selected.set(contract.id, contract);
	}
	if (clientReferences.length) {
		const { clients: clientList } = await api.get('/api/clients');
		for (const reference of clientReferences) {
			const client = resolveClient(reference, clientList);
			for (const contract of contractList) if (contract.clientId === client.id) selected.set(contract.id, contract);
		}
	}
	return [...selected.values()];
}

export function describeRange({ from, to }) {
	if (!from && !to) return 'all time';
	if (!to) return `from ${from}`;
	if (!from) return `up to ${to}`;
	return `${from} to ${to}`;
}

/** Header line, then one line per contract with time, labels padded to one column */
export function formatTotal(result, range) {
	const entries = `${result.entryCount} ${result.entryCount === 1 ? 'entry' : 'entries'}`;
	const lines = [`Total ${formatMinutes(result.totalMinutes)} (${entries}) · ${describeRange(range)}`];
	const labels = result.contracts.map((contract) => `${contract.clientShortCode}/${contract.contractName}`);
	const labelWidth = Math.max(0, ...labels.map((label) => label.length));
	const durationWidth = Math.max(0, ...result.contracts.map((contract) => formatMinutes(contract.totalMinutes).length));
	result.contracts.forEach((contract, index) => {
		lines.push(`  ${labels[index].padEnd(labelWidth)}  ${formatMinutes(contract.totalMinutes).padStart(durationWidth)}  (${contract.entryCount})`);
	});
	return lines.join('\n');
}

export async function total({ api, print, flags, flagValues }) {
	const selection = await resolveContractSelection(api, flags, flagValues);
	const range = await resolveRange(api, flags);
	const params = new URLSearchParams();
	if (range.from) params.set('from', range.from);
	if (range.to) params.set('to', range.to);
	params.set('contracts', selection === 'all' ? 'all' : selection.map((contract) => contract.id).join(','));
	const result = await api.get(`/api/time-entries/total?${params}`);
	const contracts =
		selection === 'all'
			? 'all'
			: selection.map((contract) => ({ id: contract.id, clientShortCode: contract.clientShortCode, name: contract.name }));
	print(formatTotal(result, range), { ...result, range, contracts });
}
