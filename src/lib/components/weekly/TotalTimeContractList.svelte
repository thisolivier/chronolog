<!--
	Contract checkboxes for TotalTimeModal (sprint 065-TT; r1 layout TT-08 / TT-10, sprint 066-TR).
	Shared by the desktop Contracts column and the phone's contract sheet, over the same selection.
	Contracts in use are grouped by client, each group in the client's wash with the client name as
	its heading. A row is the contract's pattern mark, its name (wrapping, never split) and a real
	checkbox at the far right; the whole row is the label, so it toggles anywhere. A ticked row is a
	surface-coloured punch-out within the tint, the checkbox in pine (`accent-color`). Inactive,
	archived and deleted (the system Deleted Contract) contracts, each marked, sit under one
	collapsed toggle naming the kinds it holds; closing it never unticks what it hides.
-->
<script lang="ts">
	import ContractMark from '$lib/components/identity/ContractMark.svelte';
	import { groupContractsByClient } from '$lib/utils/group-contracts-by-client';
	import { getClientBgClass, getClientWashTextClass } from '$lib/utils/client-colors';
	import { contractStatusLabel, hiddenToggleLabel, orderContractsForPicker, type PickerContract } from './total-time';

	let {
		contracts,
		isSelected,
		onToggle,
		isHiddenOpen = $bindable(false)
	}: {
		contracts: PickerContract[];
		isSelected: (contractId: string) => boolean;
		onToggle: (contractId: string) => void;
		/** The inactive / archived / deleted disclosure; kept by the modal across layouts */
		isHiddenOpen?: boolean;
	} = $props();

	const ordered = $derived(orderContractsForPicker(contracts));
	const shownGroups = $derived(groupContractsByClient(ordered.shown));
	const hiddenGroups = $derived(groupContractsByClient(ordered.hidden));
</script>

{#snippet contractGroups(groups: typeof shownGroups)}
	{#each groups as group (group.clientId)}
		<div
			class="rounded-panel px-1 pt-1 pb-1 {getClientBgClass(group.clientColorIndex)}"
			role="group"
			aria-label={group.clientName}
			data-testid="total-time-client-group"
		>
			<p class="px-2 pt-0.5 pb-1 text-sm font-semibold {getClientWashTextClass(group.clientColorIndex)}">{group.clientName}</p>
			{#each group.contracts as contract (contract.id)}
				{@const statusLabel = contractStatusLabel(contract)}
				{@const isTicked = isSelected(contract.id)}
				<label
					class={[
						'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-control px-2 py-1.5 text-sm pointer-coarse:min-h-11',
						isTicked ? 'bg-surface shadow-panel ring-1 ring-divider' : 'hover:bg-surface/50'
					]}
					data-testid="total-time-contract-row"
				>
					<ContractMark contractName={contract.name} contractId={contract.id} colorIndex={contract.clientColorIndex} size="md" muted={statusLabel !== null} />
					<span class="min-w-0 flex-1">
						<span class="block font-medium break-words text-ink">{contract.name}</span>
						{#if statusLabel}<span class="block text-xs text-ink-muted" data-testid="total-time-contract-status">{statusLabel}</span>{/if}
					</span>
					<input
						type="checkbox"
						checked={isTicked}
						onchange={() => onToggle(contract.id)}
						class="size-4.5 shrink-0 cursor-pointer accent-pine-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
						data-testid="total-time-contract-{contract.id}"
					/>
				</label>
			{/each}
		</div>
	{/each}
{/snippet}

<div class="space-y-2" data-testid="total-time-contract-list">
	{#if contracts.length === 0}
		<p class="text-sm text-ink-faint italic">No contracts yet</p>
	{/if}
	{@render contractGroups(shownGroups)}
	{#if hiddenGroups.length > 0}
		<details class="border-t border-divider pt-2" bind:open={isHiddenOpen} data-testid="total-time-inactive">
			<summary class="cursor-pointer rounded-control px-1 py-1 text-sm text-ink-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none pointer-coarse:min-h-11 pointer-coarse:leading-[2.25rem]">
				{hiddenToggleLabel(ordered.hidden)}
			</summary>
			<div class="mt-2 space-y-2">{@render contractGroups(hiddenGroups)}</div>
		</details>
	{/if}
</div>
