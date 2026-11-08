import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ContractMark from './ContractMark.svelte';
import { TILE_MOTIFS, tileIndexForContract } from './tile-library';

/** Server-render the mark: enough to check its markup with no DOM library */
const markup = (props: Record<string, unknown>) =>
	render(ContractMark, { props: { contractName: 'Rank Group', colorIndex: 1, size: 'sm', ...props } }).body;

describe('ContractMark', () => {
	it('falls back to the initials square without a contract id', () => {
		const html = markup({});
		expect(html).toContain('data-testid="contract-mark"');
		expect(html).toContain('RG');
		expect(html).not.toContain('data-tile');
		expect(html).not.toContain('mask-image');
	});

	it("treats an empty contract id (the link picker's default) as missing", () => {
		const html = markup({ contractId: '' });
		expect(html).toContain('RG');
		expect(html).not.toContain('data-tile');
	});

	it('draws the contract tile, with no initials, when the id is known', () => {
		const contractId = '3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b';
		const html = markup({ contractId });
		expect(html).toContain(`data-tile="${TILE_MOTIFS[tileIndexForContract(contractId)].id}"`);
		expect(html).toContain('mask-image');
		expect(html).not.toContain('RG');
	});
});
