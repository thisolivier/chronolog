<!--
	Contract checkboxes for TotalTimeModal (sprint 065-TT): All / None above the list (None makes
	picking one contract a single tap after), active contracts grouped by client with the client's
	colour tile, short code and name, and inactive contracts under a collapsed "Show inactive".
-->
<script lang="ts">
	import { groupContractsByClient } from '$lib/utils/group-contracts-by-client';
	import { getClientDotClass } from '$lib/utils/client-colors';
	import type { ContractOption } from '$lib/services/types';
	import { orderContractsForPicker } from './total-time';

	let {
		contracts,
		isSelected,
		onToggle,
		onSelectAll,
		onSelectNone
	}: {
		contracts: ContractOption[];
		isSelected: (contractId: string) => boolean;
		onToggle: (contractId: string) => void;
		onSelectAll: () => void;
		onSelectNone: () => void;
	} = $props();

	const ordered = $derived(orderContractsForPicker(contracts));
	const activeGroups = $derived(groupContractsByClient(ordered.active));
	const inactiveGroups = $derived(groupContractsByClient(ordered.inactive));
</script>

{#snippet contractGroups(groups: typeof activeGroups, isInactive: boolean)}
	{#each groups as group (group.clientId)}
		{@const shortCode = group.contracts[0]?.clientShortCode ?? ''}
		<div class="mt-2 first:mt-0">
			<p class="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
				<span class="inline-block h-2.5 w-2.5 shrink-0 rounded-sm {getClientDotClass(group.clientColorIndex)}" aria-hidden="true"></span>
				<span>{shortCode}</span>
				<span class="truncate font-normal text-ink-muted">{group.clientName}</span>
			</p>
			{#each group.contracts as contract (contract.id)}
				<label class="flex min-h-8 cursor-pointer items-center gap-2 rounded-control px-1 text-sm text-ink hover:bg-sunken pointer-coarse:min-h-11">
					<input
						type="checkbox"
						checked={isSelected(contract.id)}
						onchange={() => onToggle(contract.id)}
						class="h-4 w-4 rounded border-line text-pine-600 focus:ring-focus"
						data-testid="total-time-contract-{contract.id}"
					/>
					<span class="min-w-0 truncate">{contract.name}</span>
					{#if isInactive}<span class="text-xs text-ink-faint">inactive</span>{/if}
				</label>
			{/each}
		</div>
	{/each}
{/snippet}

<div role="group" aria-labelledby="total-time-contracts-label">
	<div class="flex items-center gap-2">
		<span id="total-time-contracts-label" class="text-xs font-medium text-ink-muted">Contracts</span>
		<button type="button" onclick={onSelectAll} class="ml-auto rounded-control border border-line px-2.5 py-0.5 text-xs btn-quiet pointer-coarse:py-2" data-testid="total-time-select-all">All</button>
		<button type="button" onclick={onSelectNone} class="rounded-control border border-line px-2.5 py-0.5 text-xs btn-quiet pointer-coarse:py-2" data-testid="total-time-select-none">None</button>
	</div>
	<div class="mt-2">
		{#if contracts.length === 0}
			<p class="text-sm text-ink-faint italic">No contracts yet</p>
		{/if}
		{@render contractGroups(activeGroups, false)}
		{#if inactiveGroups.length > 0}
			<details class="mt-3" data-testid="total-time-inactive">
				<summary class="cursor-pointer text-xs text-ink-muted">Show inactive ({ordered.inactive.length})</summary>
				<div class="mt-2">{@render contractGroups(inactiveGroups, true)}</div>
			</details>
		{/if}
	</div>
</div>
