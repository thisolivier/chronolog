import { json } from '@sveltejs/kit';
import { getTotalTime, type TotalTimeContractSelection } from '$lib/server/db/queries/time-entries-total';
import { isCalendarDate } from '$lib/utils/local-calendar';
import { isUuid } from '$lib/utils/uuid';
import type { RequestHandler } from './$types';

/** `contracts=all` is every contract; an empty or missing value is none (a zero total). */
function parseContractSelection(contractsParam: string | null): TotalTimeContractSelection | null {
	const trimmed = (contractsParam ?? '').trim();
	if (trimmed === 'all') return 'all';
	if (trimmed === '') return [];
	const contractIds = [...new Set(trimmed.split(',').map((contractId) => contractId.trim()).filter(Boolean))];
	return contractIds.every(isUuid) ? contractIds : null;
}

/**
 * GET /api/time-entries/total?from=&to=&contracts= (sprint 065-TT): minutes recorded per contract.
 * `from` / `to` are inclusive `YYYY-MM-DD`, each optional (both omitted is all time).
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const currentUser = locals.user;
	if (!currentUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const fromDate = url.searchParams.get('from')?.trim() || null;
	const toDate = url.searchParams.get('to')?.trim() || null;
	if ((fromDate && !isCalendarDate(fromDate)) || (toDate && !isCalendarDate(toDate))) {
		return json({ error: 'from and to must be dates (YYYY-MM-DD)' }, { status: 400 });
	}
	if (fromDate && toDate && fromDate > toDate) {
		return json({ error: 'from must be on or before to' }, { status: 400 });
	}

	const contractSelection = parseContractSelection(url.searchParams.get('contracts'));
	if (!contractSelection) {
		return json({ error: 'contracts must be "all" or comma-separated contract IDs' }, { status: 400 });
	}

	return json(await getTotalTime(currentUser.id, { fromDate, toDate, contractSelection }));
};
