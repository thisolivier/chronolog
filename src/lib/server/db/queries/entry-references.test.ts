/** Sprint 032-CL: the one validation function for an entry's contract, deliverable and work type. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { assertEntryReferences, EntryReferenceError } from './entry-references';
import {
	removeEntryReferenceFixture,
	seedEntryReferenceFixture,
	type EntryReferenceFixture
} from './entry-reference-fixture';

let fixture: EntryReferenceFixture;

beforeAll(async () => {
	fixture = await seedEntryReferenceFixture('refs');
});

afterAll(async () => {
	await removeEntryReferenceFixture(fixture);
});

async function failureOf(promise: Promise<void>): Promise<EntryReferenceError> {
	try {
		await promise;
	} catch (failure) {
		expect(failure).toBeInstanceOf(EntryReferenceError);
		return failure as EntryReferenceError;
	}
	throw new Error('expected assertEntryReferences to throw');
}

describe('assertEntryReferences', () => {
	it('accepts a consistent contract, deliverable and work type (and each level left empty)', async () => {
		const { ownerId: userId, research, discovery, interviews } = fixture;
		await expect(
			assertEntryReferences({ userId, contractId: research.id, deliverableId: discovery.id, workTypeId: interviews.id })
		).resolves.toBeUndefined();
		await expect(assertEntryReferences({ userId, contractId: research.id, deliverableId: discovery.id })).resolves.toBeUndefined();
		await expect(assertEntryReferences({ userId, contractId: research.id, deliverableId: null, workTypeId: null })).resolves.toBeUndefined();
	});

	it('rejects a contract that is not the user’s with 403 contract_forbidden', async () => {
		const failure = await failureOf(
			assertEntryReferences({ userId: fixture.ownerId, contractId: fixture.strangerContract.id })
		);
		expect(failure).toMatchObject({ status: 403, code: 'contract_forbidden' });
		const notUuid = await failureOf(assertEntryReferences({ userId: fixture.ownerId, contractId: 'nope' }));
		expect(notUuid).toMatchObject({ status: 400, code: 'invalid_contract' });
	});

	it('rejects a deliverable on another contract, naming both contracts', async () => {
		const failure = await failureOf(
			assertEntryReferences({ userId: fixture.ownerId, contractId: fixture.research.id, deliverableId: fixture.support.id })
		);
		expect(failure).toMatchObject({ status: 400, code: 'deliverable_mismatch' });
		expect(failure.message).toBe('Deliverable "Support" belongs to contract "Retainer", not "Research"');
	});

	it('rejects another user’s deliverable without naming it', async () => {
		const failure = await failureOf(
			assertEntryReferences({
				userId: fixture.ownerId,
				contractId: fixture.research.id,
				deliverableId: fixture.strangerDeliverable.id
			})
		);
		expect(failure).toMatchObject({ status: 400, code: 'deliverable_mismatch' });
		expect(failure.message).not.toContain('Secret');
	});

	it('rejects a work type under another deliverable, naming both deliverables', async () => {
		const failure = await failureOf(
			assertEntryReferences({
				userId: fixture.ownerId,
				contractId: fixture.research.id,
				deliverableId: fixture.recommendations.id,
				workTypeId: fixture.interviews.id
			})
		);
		expect(failure).toMatchObject({ status: 400, code: 'work_type_mismatch' });
		expect(failure.message).toBe('Work type "Interviews" belongs to deliverable "Discovery", not "Recommendations"');
	});

	it('rejects a work type without a deliverable, and another user’s work type', async () => {
		const withoutDeliverable = await failureOf(
			assertEntryReferences({ userId: fixture.ownerId, contractId: fixture.research.id, workTypeId: fixture.interviews.id })
		);
		expect(withoutDeliverable).toMatchObject({ status: 400, code: 'work_type_mismatch' });
		expect(withoutDeliverable.message).toContain('the entry has no deliverable');

		const strangers = await failureOf(
			assertEntryReferences({
				userId: fixture.ownerId,
				contractId: fixture.research.id,
				deliverableId: fixture.discovery.id,
				workTypeId: fixture.strangerWorkType.id
			})
		);
		expect(strangers).toMatchObject({ status: 400, code: 'work_type_mismatch' });
		expect(strangers.message).not.toContain('Hidden');
	});
});
