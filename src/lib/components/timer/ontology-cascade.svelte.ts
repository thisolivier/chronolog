/**
 * OntologyCascade — the one contract → deliverable → work type controller (design r1 IN-03,
 * TC-05, sprint 055-DR). The completion form and the Add Time Entry modal use it through
 * `CascadeFields.svelte`; the timesheet's inline editors (stage 6) should adopt it too.
 *
 * The selection lives with the host (the capture store, or the modal's own state): the cascade
 * reads and writes it through `selection()`, so a remount finds the same values. The rules are
 * the pure functions in `ontology-cascade.ts`:
 * - every level is always drawn, in one of five states (waiting, loading, ready, not applicable,
 *   failed), so nothing pops in or moves the form;
 * - exactly one option is chosen automatically, when a level loads, and the chain continues;
 * - a parent change keeps still-valid descendants and clears the rest;
 * - a failed load keeps the held value for the same parent and can be retried; after a parent
 *   change it clears the old parent's child;
 * - an explicit "No deliverable" / "No work type" is stored as CASCADE_NONE, so a remount never
 *   re-applies the sole-option rule over it (only a parent change does).
 *
 * Construct it in a component's script, call `start()` once mounted and `dispose()` on unmount:
 * a disposed cascade never writes again. Loads are cached per parent for the life of the
 * controller; an answer is applied only if it is the newest request and its parent is still the
 * one selected (several cascades can share one selection: the phone screen and a footer widget).
 */
import { formatContractLabel } from './contract-label';
import {
	CASCADE_NONE,
	loadedLevel,
	resolveRootSelection,
	resolveSelection,
	waitingLevel,
	type CascadeLevelName,
	type CascadeLevelState,
	type CascadeOption
} from './ontology-cascade';
import type { ContractOption, DeliverableOption, WorkTypeOption } from '$lib/services/types';

export interface CascadeSelection {
	contractId: string;
	deliverableId: string;
	workTypeId: string;
}

/** The part of DataService the cascade reads */
export interface CascadeDataSource {
	getContracts(): Promise<ContractOption[]>;
	getDeliverables(contractId: string): Promise<DeliverableOption[]>;
	getWorkTypes(deliverableId: string): Promise<WorkTypeOption[]>;
}

export class OntologyCascade {
	contract = $state<CascadeLevelState>({ status: 'loading', options: [] });
	deliverable = $state<CascadeLevelState>(waitingLevel());
	workType = $state<CascadeLevelState>(waitingLevel());
	/** True once the user picked something by hand (the modal's dirty check) */
	touchedByUser = $state(false);

	#source: CascadeDataSource;
	#selection: () => CascadeSelection;
	#requestNumbers: Record<CascadeLevelName, number> = { contract: 0, deliverable: 0, workType: 0 };
	#deliverableCache = new Map<string, CascadeOption[]>();
	#workTypeCache = new Map<string, CascadeOption[]>();
	#inFlight = new Set<Promise<void>>();
	#disposed = false;

	constructor(source: CascadeDataSource, selection: () => CascadeSelection) {
		this.#source = source;
		this.#selection = selection;
	}

	get selection(): CascadeSelection {
		return this.#selection();
	}

	/** Load every level for the held selection (call once mounted) */
	start(): Promise<void> {
		return this.#track(Promise.all([this.#loadContracts(), this.#loadDeliverables(false)]).then(() => undefined));
	}

	/** Stop writing: answers that arrive after unmount are ignored */
	dispose(): void {
		this.#disposed = true;
	}

	/** The user picked a contract (or '' for none) */
	chooseContract(contractId: string): Promise<void> {
		this.touchedByUser = true;
		this.selection.contractId = contractId;
		return this.#track(this.#loadDeliverables(true));
	}

	/** The user picked a deliverable, or CASCADE_NONE for "No deliverable" */
	chooseDeliverable(deliverableId: string): Promise<void> {
		this.touchedByUser = true;
		this.selection.deliverableId = deliverableId;
		return this.#track(this.#loadWorkTypes(true));
	}

	chooseWorkType(workTypeId: string): void {
		this.touchedByUser = true;
		this.selection.workTypeId = workTypeId;
	}

	/** Try a failed level again */
	retry(level: CascadeLevelName): Promise<void> {
		const load =
			level === 'contract'
				? this.#loadContracts()
				: level === 'deliverable'
					? this.#loadDeliverables(false)
					: this.#loadWorkTypes(false);
		return this.#track(load);
	}

	/** Resolves once no load is in flight (Save waits for it, so it never sends a stale pair) */
	async settled(): Promise<void> {
		while (this.#inFlight.size > 0) {
			await Promise.allSettled([...this.#inFlight]);
		}
	}

	#track(load: Promise<void>): Promise<void> {
		this.#inFlight.add(load);
		void load.finally(() => this.#inFlight.delete(load));
		return load;
	}

	async #loadContracts(): Promise<void> {
		const requestNumber = ++this.#requestNumbers.contract;
		this.contract = { status: 'loading', options: [] };
		let options: CascadeOption[];
		try {
			const contracts = await this.#source.getContracts();
			options = contracts.map((contract) => ({
				id: contract.id,
				name: formatContractLabel(contract.clientName, contract.name)
			}));
		} catch {
			if (this.#isCurrent('contract', requestNumber)) this.contract = { status: 'failed', options: [] };
			return;
		}
		if (!this.#isCurrent('contract', requestNumber)) return;
		this.contract = loadedLevel(options);
		const nextContractId = resolveRootSelection(this.selection.contractId, this.contract);
		if (nextContractId !== this.selection.contractId) {
			this.selection.contractId = nextContractId;
			await this.#loadDeliverables(true);
		}
	}

	async #loadDeliverables(parentChanged: boolean): Promise<void> {
		const requestNumber = ++this.#requestNumbers.deliverable;
		const contractId = this.selection.contractId;
		const level = await this.#loadLevel(contractId, this.#deliverableCache, (id) => this.#source.getDeliverables(id), () => {
			this.deliverable = { status: 'loading', options: [] };
		});
		// Applied only for the newest request, by a live cascade, while its contract is still chosen
		if (!this.#isCurrent('deliverable', requestNumber) || this.selection.contractId !== contractId) return;
		this.deliverable = level;
		const previousDeliverableId = this.selection.deliverableId;
		const nextDeliverableId = resolveSelection(previousDeliverableId, level, parentChanged);
		this.selection.deliverableId = nextDeliverableId;
		await this.#loadWorkTypes(parentChanged || nextDeliverableId !== previousDeliverableId);
	}

	async #loadWorkTypes(parentChanged: boolean): Promise<void> {
		const requestNumber = ++this.#requestNumbers.workType;
		const deliverableId = this.selection.deliverableId;
		const parentId = deliverableId === CASCADE_NONE ? '' : deliverableId;
		const level = await this.#loadLevel(parentId, this.#workTypeCache, (id) => this.#source.getWorkTypes(id), () => {
			this.workType = { status: 'loading', options: [] };
		});
		if (!this.#isCurrent('workType', requestNumber) || this.selection.deliverableId !== deliverableId) return;
		this.workType = level;
		this.selection.workTypeId = resolveSelection(this.selection.workTypeId, level, parentChanged);
	}

	#isCurrent(level: CascadeLevelName, requestNumber: number): boolean {
		return !this.#disposed && requestNumber === this.#requestNumbers[level];
	}

	/** One level's options for a parent: waiting without a parent, cached, loading, failed */
	async #loadLevel(
		parentId: string,
		cache: Map<string, CascadeOption[]>,
		fetchOptions: (parentId: string) => Promise<CascadeOption[]>,
		showLoading: () => void
	): Promise<CascadeLevelState> {
		if (!parentId) return waitingLevel();
		const cached = cache.get(parentId);
		if (cached) return loadedLevel(cached);
		showLoading();
		try {
			const options = (await fetchOptions(parentId)).map((option) => ({ id: option.id, name: option.name }));
			cache.set(parentId, options);
			return loadedLevel(options);
		} catch {
			return { status: 'failed', options: [] };
		}
	}
}
