<!--
	SidebarClientGroup — one client in the contracts sidebar (sprint 026 grouping, 033 collapse).
	Two or more contracts: the client heading (colour dot + name) with the contracts indented under it.
	Exactly one contract: a single row at the client's indent with the dot, the contract name and
	the client name beneath it in small muted text, so a scan down the dots still reads by client.
	`muted` draws the same grammar greyed for the Archived section.
-->
<script lang="ts">
	import { getClientDotClass } from '$lib/utils/client-colors';
	import type { ClientGroup } from '$lib/utils/group-contracts-by-client';
	import type { ContractsByClientResult } from '$lib/services/types';

	let {
		group,
		selectedContractId,
		muted = false,
		testId = 'sidebar-client-group',
		onSelect
	}: {
		group: ClientGroup<ContractsByClientResult>;
		selectedContractId: string | null;
		muted?: boolean;
		testId?: string;
		onSelect: (contractId: string, clientId: string) => void;
	} = $props();

	const isSingleContract = $derived(group.contracts.length === 1);
	const holdsSelection = $derived(group.contracts.some((contract) => contract.id === selectedContractId));
	const dotClass = $derived(`${getClientDotClass(group.clientColorIndex)} ${muted ? 'opacity-50' : ''}`);
	const restingRowClass = $derived(muted ? 'text-stone-500 hover:bg-stone-100' : 'text-stone-700 hover:bg-stone-100');
</script>

{#snippet noteCount(count: number)}
	{#if count > 0}
		<span
			class="flex-shrink-0 text-[11px] tabular-nums text-stone-400"
			title="{count} {count === 1 ? 'note' : 'notes'}"
			data-testid="sidebar-note-count"
		>
			{count}
		</span>
	{/if}
{/snippet}

{#snippet inactiveMark(isActive: boolean)}
	{#if !isActive}
		<span class="ml-1 text-xs text-stone-400">(inactive)</span>
	{/if}
{/snippet}

<div class="mb-2" role="group" aria-label={group.clientName} data-testid={testId}>
	{#if isSingleContract}
		{@const contract = group.contracts[0]}
		{@const isSelected = selectedContractId === contract.id}
		<button
			onclick={() => onSelect(contract.id, contract.clientId)}
			class="flex w-full items-start gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors {isSelected
				? 'bg-blue-50 text-blue-700'
				: restingRowClass}"
			class:opacity-50={!contract.isActive}
			data-contract-id={contract.id}
			data-testid="sidebar-single-contract-row"
			aria-current={isSelected ? 'page' : undefined}
		>
			<span class="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full {dotClass}" aria-hidden="true"></span>
			<span class="min-w-0 flex-1 truncate">{contract.name}{@render inactiveMark(contract.isActive)}<span
					class="block truncate text-[11px] leading-4 {isSelected ? 'text-blue-600' : 'text-stone-400'}"
					data-testid="sidebar-row-client-name">{group.clientName}</span
				></span>
			<span class="mt-0.5">{@render noteCount(contract.noteCount)}</span>
		</button>
	{:else}
		<div
			class="flex items-center gap-2 px-3 pt-1 pb-0.5 text-xs font-semibold {holdsSelection
				? 'text-blue-700'
				: muted
					? 'text-stone-400'
					: 'text-stone-500'}"
			data-testid="sidebar-client-heading"
		>
			<span class="inline-block h-2 w-2 flex-shrink-0 rounded-full {dotClass}" aria-hidden="true"></span>
			<span class="truncate">{group.clientName}</span>
		</div>
		{#each group.contracts as contract (contract.id)}
			{@const isSelected = selectedContractId === contract.id}
			<button
				onclick={() => onSelect(contract.id, contract.clientId)}
				class="flex w-full items-center gap-2 rounded-md py-1.5 pr-3 pl-7 text-left text-sm transition-colors {isSelected
					? 'bg-blue-50 text-blue-700'
					: restingRowClass}"
				class:opacity-50={!contract.isActive}
				data-contract-id={contract.id}
				aria-current={isSelected ? 'page' : undefined}
			>
				<span class="min-w-0 flex-1 truncate">{contract.name}{@render inactiveMark(contract.isActive)}</span>
				{@render noteCount(contract.noteCount)}
			</button>
		{/each}
	{/if}
</div>
