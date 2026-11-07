import { describe, expect, it } from 'vitest';
import { levelPlaceholder, loadedLevel, resolveRootSelection, resolveSelection, waitingLevel } from './ontology-cascade';
import { OntologyCascade, type CascadeDataSource, type CascadeSelection } from './ontology-cascade.svelte';

const option = (id: string) => ({ id, name: id.toUpperCase() });

describe('cascade rules (pure)', () => {
	it('selects the sole option and keeps a valid value', () => {
		expect(resolveSelection('', loadedLevel([option('a')]))).toBe('a');
		expect(resolveSelection('b', loadedLevel([option('a'), option('b')]))).toBe('b');
		expect(resolveSelection('', loadedLevel([option('a'), option('b')]))).toBe('');
	});

	it('clears an invalid value, or replaces it with the sole option', () => {
		expect(resolveSelection('x', loadedLevel([option('a'), option('b')]))).toBe('');
		expect(resolveSelection('x', loadedLevel([option('a')]))).toBe('a');
	});

	it('distinguishes waiting, not applicable and failed', () => {
		expect(loadedLevel([]).status).toBe('not-applicable');
		expect(resolveSelection('x', waitingLevel())).toBe('');
		expect(resolveSelection('x', loadedLevel([]))).toBe('');
		expect(resolveSelection('x', { status: 'failed', options: [] })).toBe('x');
		expect(resolveSelection('x', { status: 'loading', options: [] })).toBe('x');
		expect(levelPlaceholder('workType', waitingLevel(), false)).toBe('Choose a deliverable first');
		expect(levelPlaceholder('workType', loadedLevel([]), false)).toBe('Not applicable');
		expect(levelPlaceholder('deliverable', { status: 'failed', options: [] }, true)).toBe(
			"Couldn't load deliverables: your choice is kept"
		);
		expect(levelPlaceholder('deliverable', loadedLevel([option('a')]), false)).toBe('');
	});

	it('keeps a held root value even when the list does not offer it', () => {
		expect(resolveRootSelection('archived', loadedLevel([option('a')]))).toBe('archived');
		expect(resolveRootSelection('', loadedLevel([option('a')]))).toBe('a');
		expect(resolveRootSelection('', loadedLevel([option('a'), option('b')]))).toBe('');
	});
});

/** Contracts c1 (two deliverables), c2 (one deliverable with one work type), c3 (none) */
function fakeSource(overrides: Partial<CascadeDataSource> = {}): CascadeDataSource & { calls: string[] } {
	const calls: string[] = [];
	const deliverables: Record<string, string[]> = { c1: ['d1', 'd2'], c2: ['d3'], c3: [] };
	const workTypes: Record<string, string[]> = { d1: ['w1', 'w2'], d2: ['w1'], d3: ['w3'] };
	return {
		calls,
		getContracts: async () => {
			calls.push('contracts');
			return ['c1', 'c2', 'c3'].map((id) => ({ id, name: id, clientName: 'Client' }) as never);
		},
		getDeliverables: async (contractId) => {
			calls.push(`deliverables:${contractId}`);
			return (deliverables[contractId] ?? []).map(option);
		},
		getWorkTypes: async (deliverableId) => {
			calls.push(`workTypes:${deliverableId}`);
			return (workTypes[deliverableId] ?? []).map(option);
		},
		...overrides
	};
}

function cascadeWith(source: CascadeDataSource, initial: Partial<CascadeSelection> = {}) {
	const selection: CascadeSelection = { contractId: '', deliverableId: '', workTypeId: '', ...initial };
	return { selection, cascade: new OntologyCascade(source, () => selection) };
}

describe('OntologyCascade', () => {
	it('fills a sole-option chain: one deliverable, then its one work type', async () => {
		const { selection, cascade } = cascadeWith(fakeSource());
		await cascade.start();
		expect(cascade.deliverable.status).toBe('waiting');
		expect(cascade.workType.status).toBe('waiting');
		await cascade.chooseContract('c2');
		expect(selection).toEqual({ contractId: 'c2', deliverableId: 'd3', workTypeId: 'w3' });
	});

	it('several options: nothing is chosen for the user', async () => {
		const { selection, cascade } = cascadeWith(fakeSource());
		await cascade.start();
		await cascade.chooseContract('c1');
		expect(selection.deliverableId).toBe('');
		expect(cascade.deliverable.status).toBe('ready');
		expect(cascade.workType.status).toBe('waiting');
	});

	it('a contract with no deliverables is not applicable, not waiting or failed', async () => {
		const { selection, cascade } = cascadeWith(fakeSource(), { contractId: 'c3' });
		await cascade.start();
		expect(cascade.deliverable.status).toBe('not-applicable');
		expect(cascade.workType.status).toBe('waiting');
		expect(selection.deliverableId).toBe('');
	});

	it('a deliverable change keeps a work type that is still valid and clears one that is not', async () => {
		const { selection, cascade } = cascadeWith(fakeSource(), { contractId: 'c1', deliverableId: 'd1', workTypeId: 'w1' });
		await cascade.start();
		expect(selection.workTypeId).toBe('w1');
		await cascade.chooseDeliverable('d2');
		expect(selection.workTypeId).toBe('w1');
		cascade.chooseWorkType('w1');
		await cascade.chooseDeliverable('d1');
		expect(selection.workTypeId).toBe('w1');
		selection.workTypeId = 'w2';
		await cascade.chooseDeliverable('d2');
		// w2 is not offered under d2: cleared, and d2's sole option w1 is chosen
		expect(selection.workTypeId).toBe('w1');
	});

	it('a contract change clears an invalid deliverable and re-applies the sole-option rule', async () => {
		const { selection, cascade } = cascadeWith(fakeSource(), { contractId: 'c1', deliverableId: 'd1', workTypeId: 'w2' });
		await cascade.start();
		await cascade.chooseContract('c2');
		expect(selection).toEqual({ contractId: 'c2', deliverableId: 'd3', workTypeId: 'w3' });
		await cascade.chooseContract('c3');
		expect(selection).toEqual({ contractId: 'c3', deliverableId: '', workTypeId: '' });
	});

	it('a failed load keeps the held value and Retry recovers', async () => {
		let failing = true;
		const source = fakeSource();
		const flaky = fakeSource({
			getWorkTypes: async (deliverableId) => {
				if (failing) throw new Error('network');
				return source.getWorkTypes(deliverableId);
			}
		});
		const { selection, cascade } = cascadeWith(flaky, { contractId: 'c1', deliverableId: 'd1', workTypeId: 'w2' });
		await cascade.start();
		expect(cascade.workType.status).toBe('failed');
		expect(selection.workTypeId).toBe('w2');
		failing = false;
		await cascade.retry('workType');
		expect(cascade.workType.status).toBe('ready');
		expect(selection.workTypeId).toBe('w2');
	});

	it('a failed contract list keeps the held contract and still loads its children', async () => {
		const source = fakeSource({
			getContracts: async () => {
				throw new Error('network');
			}
		});
		const { selection, cascade } = cascadeWith(source, { contractId: 'c2' });
		await cascade.start();
		expect(cascade.contract.status).toBe('failed');
		expect(selection).toEqual({ contractId: 'c2', deliverableId: 'd3', workTypeId: 'w3' });
	});

	it('the newest parent wins when answers arrive out of order; settled waits for it', async () => {
		let releaseSlow: () => void = () => {};
		const source = fakeSource();
		const slow = fakeSource({
			getDeliverables: (contractId) =>
				contractId === 'c1'
					? new Promise((resolve) => (releaseSlow = () => resolve([option('d1'), option('d2')])))
					: source.getDeliverables(contractId)
		});
		const { selection, cascade } = cascadeWith(slow);
		await cascade.start();
		void cascade.chooseContract('c1');
		void cascade.chooseContract('c2');
		releaseSlow();
		await cascade.settled();
		expect(selection).toEqual({ contractId: 'c2', deliverableId: 'd3', workTypeId: 'w3' });
		expect(cascade.deliverable.options.map((each) => each.id)).toEqual(['d3']);
	});

	it('only one contract: it is chosen, and so are its sole children', async () => {
		const source = fakeSource({ getContracts: async () => [{ id: 'c2', name: 'c2', clientName: 'Client' } as never] });
		const { selection, cascade } = cascadeWith(source);
		await cascade.start();
		expect(selection).toEqual({ contractId: 'c2', deliverableId: 'd3', workTypeId: 'w3' });
		expect(cascade.touchedByUser).toBe(false);
	});

	it('caches options per parent', async () => {
		const source = fakeSource();
		const { cascade } = cascadeWith(source, { contractId: 'c1' });
		await cascade.start();
		await cascade.chooseContract('c2');
		await cascade.chooseContract('c1');
		expect(source.calls.filter((call) => call === 'deliverables:c1')).toHaveLength(1);
	});
});
