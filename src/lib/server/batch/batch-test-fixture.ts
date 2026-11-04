/**
 * Test fixture for sprint 038-CL's batch routes: an owner (`qa-038-…`) with two contracts, a
 * "Discovery" deliverable with an "Interviews" work type on the first, a "Support" deliverable
 * on the second, and a stranger with a contract of their own. `callBatch` calls a route handler
 * directly against the dev database.
 */
import { eq, inArray } from 'drizzle-orm';
import { database, clients, contracts, notes, timeEntries, users } from '$lib/server/db';
import { createClient } from '$lib/server/db/queries/clients';
import { createContract } from '$lib/server/db/queries/contracts';
import { createDeliverable } from '$lib/server/db/queries/deliverables';
import { createWorkType } from '$lib/server/db/queries/work-types';

export type BatchFixture = Awaited<ReturnType<typeof seedBatchFixture>>;
type AnyHandler = (event: never) => Response | Promise<Response>;

export async function seedBatchFixture(label: string) {
	const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-7);
	const ownerId = `qa-038-${label}-owner-${suffix}`;
	const strangerId = `qa-038-${label}-stranger-${suffix}`;
	await database.insert(users).values([
		{ id: ownerId, name: ownerId, email: `${ownerId}@example.com` },
		{ id: strangerId, name: strangerId, email: `${strangerId}@example.com` }
	]);
	const ownerClient = await createClient(ownerId, 'Acme', `B${suffix}`);
	const strangerClient = await createClient(strangerId, 'Other', `X${suffix}`);
	const research = await createContract(ownerClient.id, 'Research', null, true);
	const retainer = await createContract(ownerClient.id, 'Retainer', null, true);
	const strangerContract = await createContract(strangerClient.id, 'Theirs', null, true);
	const discovery = await createDeliverable(research.id, 'Discovery', 0);
	const support = await createDeliverable(retainer.id, 'Support', 0);
	const interviews = await createWorkType(discovery.id, 'Interviews', 0);
	return { ownerId, strangerId, shortCode: ownerClient.shortCode, research, retainer, strangerContract, discovery, support, interviews };
}

export async function removeBatchFixture(fixture: BatchFixture) {
	const userIds = [fixture.ownerId, fixture.strangerId];
	await database.delete(timeEntries).where(inArray(timeEntries.userId, userIds));
	await database.delete(notes).where(inArray(notes.userId, userIds));
	for (const userId of userIds) {
		const ownedClients = await database.select({ id: clients.id }).from(clients).where(eq(clients.userId, userId));
		for (const client of ownedClients) await database.delete(contracts).where(eq(contracts.clientId, client.id));
		await database.delete(clients).where(eq(clients.userId, userId));
	}
	await database.delete(users).where(inArray(users.id, userIds));
}

export async function callBatch(handler: AnyHandler, userId: string, body: unknown, timezone = 'Europe/London') {
	const url = new URL('http://localhost/api/batch');
	const request = new Request(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-Timezone': timezone },
		body: JSON.stringify(body)
	});
	const event = { locals: { user: { id: userId }, session: null }, request, url, params: {} };
	const response = await handler(event as never);
	return { status: response.status, body: await response.json() };
}
