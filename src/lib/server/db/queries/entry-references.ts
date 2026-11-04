/**
 * The one rule for what a time entry may point at (sprint 032-CL): its contract is the user's,
 * its deliverable (if any) is on that contract, and its work type (if any) is under that
 * deliverable, so a work type without a deliverable is an error too.
 *
 * Every write path (`POST /api/time-entries`, `PUT`/`PATCH /api/time-entries/[id]`,
 * `POST /api/timer/start`, `POST /api/timer/save`) calls `assertEntryReferences`; the API layer
 * turns an `EntryReferenceError` into its status and code (`entryReferenceProblem` in
 * `src/routes/api/time-entries/entry-input.ts`).
 *
 * Lookups go through the client's `user_id`, so another user's deliverable or work type is
 * reported by id only: its name is never shown to someone who does not own it.
 */

import { and, eq } from 'drizzle-orm';
import { database, clients, contracts, deliverables, workTypes } from '$lib/server/db';
import { decryptText } from '$lib/server/crypto/server-cipher';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EntryReferenceCode =
	| 'invalid_contract'
	| 'contract_forbidden'
	| 'deliverable_mismatch'
	| 'work_type_mismatch';

export class EntryReferenceError extends Error {
	readonly status: 400 | 403;
	readonly code: EntryReferenceCode;

	constructor(status: 400 | 403, code: EntryReferenceCode, message: string) {
		super(message);
		this.name = 'EntryReferenceError';
		this.status = status;
		this.code = code;
	}
}

export type EntryReferences = {
	userId: string;
	contractId: string;
	deliverableId?: string | null;
	workTypeId?: string | null;
};

async function findUserContract(contractId: string, userId: string) {
	const rows = await database
		.select({ id: contracts.id, name: contracts.name })
		.from(contracts)
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(and(eq(contracts.id, contractId), eq(clients.userId, userId)))
		.limit(1);
	return rows[0] ?? null;
}

async function findUserDeliverable(deliverableId: string, userId: string) {
	const rows = await database
		.select({
			id: deliverables.id,
			name: deliverables.name,
			contractId: deliverables.contractId,
			contractName: contracts.name
		})
		.from(deliverables)
		.innerJoin(contracts, eq(deliverables.contractId, contracts.id))
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(and(eq(deliverables.id, deliverableId), eq(clients.userId, userId)))
		.limit(1);
	return rows[0] ?? null;
}

async function findUserWorkType(workTypeId: string, userId: string) {
	const rows = await database
		.select({
			id: workTypes.id,
			name: workTypes.name,
			deliverableId: workTypes.deliverableId,
			deliverableName: deliverables.name
		})
		.from(workTypes)
		.innerJoin(deliverables, eq(workTypes.deliverableId, deliverables.id))
		.innerJoin(contracts, eq(deliverables.contractId, contracts.id))
		.innerJoin(clients, eq(contracts.clientId, clients.id))
		.where(and(eq(workTypes.id, workTypeId), eq(clients.userId, userId)))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * Throws `EntryReferenceError` unless the contract is the user's, the deliverable is on it and
 * the work type is under the deliverable. Resolves to nothing when the references agree.
 */
export async function assertEntryReferences({
	userId,
	contractId,
	deliverableId,
	workTypeId
}: EntryReferences): Promise<void> {
	if (typeof contractId !== 'string' || !UUID_PATTERN.test(contractId)) {
		throw new EntryReferenceError(400, 'invalid_contract', 'contractId must be a UUID');
	}
	const contract = await findUserContract(contractId, userId);
	if (!contract) {
		throw new EntryReferenceError(403, 'contract_forbidden', 'That contract does not belong to you');
	}

	let deliverable: Awaited<ReturnType<typeof findUserDeliverable>> | null = null;
	if (deliverableId) {
		deliverable = UUID_PATTERN.test(deliverableId) ? await findUserDeliverable(deliverableId, userId) : null;
		if (!deliverable) {
			throw new EntryReferenceError(400, 'deliverable_mismatch', `Deliverable ${deliverableId} is not one of yours`);
		}
		if (deliverable.contractId !== contract.id) {
			const ownContractName = decryptText(deliverable.contractName, 'contracts.name');
			const entryContractName = decryptText(contract.name, 'contracts.name');
			throw new EntryReferenceError(
				400,
				'deliverable_mismatch',
				`Deliverable "${deliverable.name}" belongs to contract "${ownContractName}", not "${entryContractName}"`
			);
		}
	}

	if (workTypeId) {
		const workType = UUID_PATTERN.test(workTypeId) ? await findUserWorkType(workTypeId, userId) : null;
		if (!workType) {
			throw new EntryReferenceError(400, 'work_type_mismatch', `Work type ${workTypeId} is not one of yours`);
		}
		if (!deliverable) {
			throw new EntryReferenceError(
				400,
				'work_type_mismatch',
				`Work type "${workType.name}" belongs to deliverable "${workType.deliverableName}", but the entry has no deliverable`
			);
		}
		if (workType.deliverableId !== deliverable.id) {
			throw new EntryReferenceError(
				400,
				'work_type_mismatch',
				`Work type "${workType.name}" belongs to deliverable "${workType.deliverableName}", not "${deliverable.name}"`
			);
		}
	}
}
