/**
 * Total time (sprint 065-TT): the minutes a user recorded per contract, summed in Postgres, for an
 * optional inclusive date range and a set of contracts. Drafts (a running or stopped timer) are
 * never counted, as in the weekly view. Used by `GET /api/time-entries/total`.
 */
import { and, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { database, timeEntries, contracts, clients } from '$lib/server/db';
import { decryptText } from '$lib/server/crypto/server-cipher';

/** `'all'` is every contract the user has; an empty list is no contracts (a zero total). */
export type TotalTimeContractSelection = 'all' | string[];

export type TotalTimeQuery = {
	/** Inclusive `YYYY-MM-DD`; null means no lower bound */
	fromDate: string | null;
	/** Inclusive `YYYY-MM-DD`; null means no upper bound */
	toDate: string | null;
	contractSelection: TotalTimeContractSelection;
};

export type ContractTotal = {
	contractId: string;
	contractName: string;
	clientName: string;
	clientShortCode: string;
	totalMinutes: number;
	entryCount: number;
};

export type TotalTimeSummary = {
	from: string | null;
	to: string | null;
	totalMinutes: number;
	entryCount: number;
	/** Only contracts with entries in the range, most minutes first */
	contracts: ContractTotal[];
};

export async function getTotalTime(userId: string, query: TotalTimeQuery): Promise<TotalTimeSummary> {
	const summary: TotalTimeSummary = { from: query.fromDate, to: query.toDate, totalMinutes: 0, entryCount: 0, contracts: [] };
	if (query.contractSelection !== 'all' && query.contractSelection.length === 0) return summary;

	const conditions: SQL[] = [
		eq(timeEntries.userId, userId),
		eq(clients.userId, userId),
		eq(timeEntries.isDraft, false)
	];
	if (query.fromDate) conditions.push(gte(timeEntries.date, query.fromDate));
	if (query.toDate) conditions.push(lte(timeEntries.date, query.toDate));
	if (query.contractSelection !== 'all') conditions.push(inArray(timeEntries.contractId, query.contractSelection));

	const rows = await database
		.select({
			contractId: contracts.id,
			contractName: contracts.name,
			clientName: clients.name,
			clientShortCode: clients.shortCode,
			totalMinutes: sql<number>`coalesce(sum(${timeEntries.durationMinutes}), 0)`.mapWith(Number),
			entryCount: sql<number>`count(*)`.mapWith(Number)
		})
		.from(timeEntries)
		.innerJoin(contracts, eq(timeEntries.contractId, contracts.id))
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(and(...conditions))
		.groupBy(contracts.id, clients.id);

	summary.contracts = rows
		.map((row) => ({
			...row,
			contractName: decryptText(row.contractName, 'contracts.name'),
			clientName: decryptText(row.clientName, 'clients.name')
		}))
		.sort(
			(left, right) =>
				right.totalMinutes - left.totalMinutes ||
				left.clientShortCode.localeCompare(right.clientShortCode) ||
				left.contractName.localeCompare(right.contractName)
		);
	summary.totalMinutes = summary.contracts.reduce((sum, contract) => sum + contract.totalMinutes, 0);
	summary.entryCount = summary.contracts.reduce((sum, contract) => sum + contract.entryCount, 0);
	return summary;
}
