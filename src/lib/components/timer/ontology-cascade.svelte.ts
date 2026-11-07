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
 * - a failed load keeps the held value and can be retried.
 *
 * Construct it in a component's script and call `start()` once mounted. Loads are cached per
 * parent for the life of the controller; a newer request always wins over an older one.
 */
import { formatContractLabel } from './contract-label';
import {
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

	constructor(source: CascadeDataSource, selection: () => CascadeSelection) {
		this.#source = source;
		this.#selection = selection;
	}

	get selection(): CascadeSelection {
		return this.#selection();
	}

	/** Load every level for the held selection (call once mounted) */
	start(): Promise<void> {
		return this.#track(Promise.all([this.#loadContracts(), this.#loadDeliverables()]).then(() => undefined));
	}

	/** The user picked a contract (or '' for none) */
	chooseContract(contractId: string): Promise<void> {
		this.touchedByUser = true;
		this.selection.contractId = contractId;
		return this.#track(this.#loadDeliverables());
	}

	chooseDeliverable(deliverableId: string): Promise<void> {
		this.touchedByUser = true;
		this.selection.deliverableId = deliverableId;
		return this.#track(this.#loadWorkTypes());
	}

	chooseWorkType(workTypeId: string): void {
		this.touchedByUser = true;
		this.selection.workTypeId = workTypeId;
	}

	/** Try a failed level again */
	retry(level: CascadeLevelName): Promise<void> {
		const load =
			level === 'contract' ? this.#loadContracts() : level === 'deliverable' ? this.#loadDeliverables() : this.#loadWorkTypes();
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
			if (requestNumber === this.#requestNumbers.contract) this.contract = { status: 'failed', options: [] };
			return;
		}
		if (requestNumber !== this.#requestNumbers.contract) return;
		this.contract = loadedLevel(options);
		const nextContractId = resolveRootSelection(this.selection.contractId, this.contract);
		if (nextContractId !== this.selection.contractId) {
			this.selection.contractId = nextContractId;
			await this.#loadDeliverables();
		}
	}

	async #loadDeliverables(): Promise<void> {
		const requestNumber = ++this.#requestNumbers.deliverable;
		const contractId = this.selection.contractId;
		const level = await this.#loadLevel(contractId, this.#deliverableCache, (id) => this.#source.getDeliverables(id), () => {
			this.deliverable = { status: 'loading', options: [] };
		});
		if (requestNumber !== this.#requestNumbers.deliverable) return;
		this.deliverable = level;
		this.selection.deliverableId = resolveSelection(this.selection.deliverableId, level);
		await this.#loadWorkTypes();
	}

	async #loadWorkTypes(): Promise<void> {
		const requestNumber = ++this.#requestNumbers.workType;
		const deliverableId = this.selection.deliverableId;
		const level = await this.#loadLevel(deliverableId, this.#workTypeCache, (id) => this.#source.getWorkTypes(id), () => {
			this.workType = { status: 'loading', options: [] };
		});
		if (requestNumber !== this.#requestNumbers.workType) return;
		this.workType = level;
		this.selection.workTypeId = resolveSelection(this.selection.workTypeId, level);
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
