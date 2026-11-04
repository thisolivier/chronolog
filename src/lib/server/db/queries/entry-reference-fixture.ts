/**
 * Test fixture for sprint 032-CL: two users; the owner has two contracts, "Discovery" and
 * "Recommendations" deliverables on the first, an "Interviews" work type under Discovery and a
 * "Drafting" work type under Recommendations, and a deliverable on the second contract.
 * Used by `entry-references.test.ts` and `src/routes/api/entry-references-routes.test.ts`.
 */
import { eq, inArray } from 'drizzle-orm';
import { database, clients, contracts, timeEntries, users } from '$lib/server/db';
import { createClient } from './clients';
import { createContract } from './contracts';
import { createDeliverable } from './deliverables';
import { createWorkType } from './work-types';

export type EntryReferenceFixture = Awaited<ReturnType<typeof seedEntryReferenceFixture>>;

export async function seedEntryReferenceFixture(label: string) {
	const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-7);
	const ownerId = `qa-032-${label}-owner-${suffix}`;
	const strangerId = `qa-032-${label}-stranger-${suffix}`;
	await database.insert(users).values([
		{ id: ownerId, name: ownerId, email: `${ownerId}@example.com` },
		{ id: strangerId, name: strangerId, email: `${strangerId}@example.com` }
	]);
	const ownerClient = await createClient(ownerId, 'Acme', `R${suffix}`);
	const strangerClient = await createClient(strangerId, 'Other', `S${suffix}`);
	const research = await createContract(ownerClient.id, 'Research', null, true);
	const retainer = await createContract(ownerClient.id, 'Retainer', null, true);
	const strangerContract = await createContract(strangerClient.id, 'Theirs', null, true);
	const discovery = await createDeliverable(research.id, 'Discovery', 0);
	const recommendations = await createDeliverable(research.id, 'Recommendations', 1);
	const support = await createDeliverable(retainer.id, 'Support', 0);
	const strangerDeliverable = await createDeliverable(strangerContract.id, 'Secret', 0);
	const interviews = await createWorkType(discovery.id, 'Interviews', 0);
	const drafting = await createWorkType(recommendations.id, 'Drafting', 0);
	const strangerWorkType = await createWorkType(strangerDeliverable.id, 'Hidden', 0);
	return {
		ownerId,
		strangerId,
		research,
		retainer,
		strangerContract,
		discovery,
		recommendations,
		support,
		strangerDeliverable,
		interviews,
		drafting,
		strangerWorkType
	};
}

export async function removeEntryReferenceFixture(fixture: EntryReferenceFixture) {
	const userIds = [fixture.ownerId, fixture.strangerId];
	await database.delete(timeEntries).where(inArray(timeEntries.userId, userIds));
	for (const userId of userIds) {
		const ownedClients = await database.select({ id: clients.id }).from(clients).where(eq(clients.userId, userId));
		for (const client of ownedClients) await database.delete(contracts).where(eq(contracts.clientId, client.id));
		await database.delete(clients).where(eq(clients.userId, userId));
	}
	await database.delete(users).where(inArray(users.id, userIds));
}
