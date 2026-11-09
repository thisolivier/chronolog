/**
 * Sprint 065-TT: `GET /api/contracts-by-client?includeSystem=true` lists the user's system
 * "Deleted Contract" (once a deletion created it) with `system: true`, so the Total time modal can
 * tick it like any other; without the parameter the response is unchanged. Its entries count when
 * its ID is asked for, so unticking another contract takes off exactly that contract's minutes.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTimeEntry } from '$lib/server/db/queries/time-entries';
import { createContract } from '$lib/server/db/queries/contracts';
import { deleteContractWithReassignment } from '$lib/server/db/queries/safe-deletion';
import {
	removeEntryReferenceFixture,
	seedEntryReferenceFixture,
	type EntryReferenceFixture
} from '$lib/server/db/queries/entry-reference-fixture';
import * as contractsByClientRoute from './contracts-by-client/+server';
import * as totalRoute from './time-entries/total/+server';

let fixture: EntryReferenceFixture;

type ListedContract = { id: string; name: string; system?: boolean };

async function callGet(handler: (event: never) => Response | Promise<Response>, query: string) {
	const url = new URL(`http://localhost/api/test?${query}`);
	const event = { locals: { user: { id: fixture.ownerId }, session: null }, request: new Request(url), url, params: {} };
	return (await handler(event as never)).json();
}

beforeAll(async () => {
	fixture = await seedEntryReferenceFixture('system');
	await createTimeEntry({ userId: fixture.ownerId, contractId: fixture.research.id, date: '2026-11-02', durationMinutes: 60 });
	const doomed = await createContract(fixture.research.clientId, 'Doomed', null, true);
	await createTimeEntry({ userId: fixture.ownerId, contractId: doomed.id, date: '2026-11-03', durationMinutes: 17 });
	await deleteContractWithReassignment(doomed.id, fixture.ownerId);
});

afterAll(async () => {
	await removeEntryReferenceFixture(fixture);
});

describe('GET /api/contracts-by-client?includeSystem=true', () => {
	it('lists the Deleted Contract only when asked, marked system', async () => {
		const plain: ListedContract[] = (await callGet(contractsByClientRoute.GET, 'includeArchived=true')).contracts;
		expect(plain.some((contract) => contract.name === 'Deleted Contract')).toBe(false);
		expect(plain.every((contract) => !('system' in contract))).toBe(true);

		const withSystem: ListedContract[] = (await callGet(contractsByClientRoute.GET, 'includeArchived=true&includeSystem=true')).contracts;
		const deleted = withSystem.filter((contract) => contract.system);
		expect(deleted.map((contract) => contract.name)).toEqual(['Deleted Contract']);
		expect(withSystem.filter((contract) => !contract.system)).toHaveLength(plain.length);
	});

	it('every listed ID adds up to the all-contracts total; dropping one drops exactly its minutes', async () => {
		const listed: ListedContract[] = (await callGet(contractsByClientRoute.GET, 'includeArchived=true&includeSystem=true')).contracts;
		const everyId = listed.map((contract) => contract.id);
		const allTotal = await callGet(totalRoute.GET, 'contracts=all');
		const listedTotal = await callGet(totalRoute.GET, `contracts=${everyId.join(',')}`);
		expect(listedTotal.totalMinutes).toBe(77);
		expect(listedTotal.totalMinutes).toBe(allTotal.totalMinutes);
		const withoutResearch = await callGet(totalRoute.GET, `contracts=${everyId.filter((id) => id !== fixture.research.id).join(',')}`);
		expect(withoutResearch.totalMinutes).toBe(17);
	});
});
