<!--
	SidebarClientGroup — one client in the contracts sidebar (sprint 026 grouping, 033 collapse).
	Two or more contracts: the client heading with the contracts indented under it. The heading is the
	client's name with its colour dot, which opens the client view (`/notes/client/<id>`), and at the
	right edge a chevron (collapse; sprint 039-CL), lined up under the Contracts heading's + (049-UI).
	A collapsed client still shows its open contract.
	Exactly one contract: a single row at the client's indent with the dot, the contract name and
	the client name beneath it in small muted text, so a scan down the dots still reads by client.
	`muted` draws the same grammar greyed for the Archived section (no chevron, no client view).
	`reorder` (active clients only) makes the heading or single row draggable and moves it with
	Alt+ArrowUp / Alt+ArrowDown.
-->
<script lang="ts">
	import { getClientDotClass } from '$lib/utils/client-colors';
	import type { ClientGroup } from '$lib/utils/group-contracts-by-client';
	import type { ContractsByClientResult } from '$lib/services/types';
	import type { ClientReorderController } from './client-reorder.svelte';

	let {
		group,
		selectedContractId,
		muted = false,
		testId = 'sidebar-client-group',
		onSelect,
		viewedClientId = null,
		onOpenClient,
		isCollapsed = false,
		onToggleCollapse,
		reorder
	}: {
		group: ClientGroup<ContractsByClientResult>;
		selectedContractId: string | null;
		muted?: boolean;
		testId?: string;
		onSelect: (contractId: string, clientId: string) => void;
		/** The client whose notes the list shows (client view), to highlight its name */
		viewedClientId?: string | null;
		onOpenClient?: (clientId: string) => void;
		isCollapsed?: boolean;
		onToggleCollapse?: (clientId: string) => void;
		reorder?: ClientReorderController;
	} = $props();

	let groupElement = $state<HTMLElement | null>(null);

	const isSingleContract = $derived(group.contracts.length === 1);
	const holdsSelection = $derived(group.contracts.some((contract) => contract.id === selectedContractId));
	const isViewedClient = $derived(viewedClientId === group.clientId);
	const dotClass = $derived(`${getClientDotClass(group.clientColorIndex)} ${muted ? 'opacity-50' : ''}`);
	const restingRowClass = $derived(muted ? 'text-stone-500 hover:bg-stone-100' : 'text-stone-700 hover:bg-stone-100');
	const canCollapse = $derived(!muted && !isSingleContract && Boolean(onToggleCollapse));
	// Collapsed: only the open contract stays visible, so the selection is never hidden
	const visibleContracts = $derived(
		canCollapse && isCollapsed ? group.contracts.filter((contract) => contract.id === selectedContractId) : group.contracts
	);
	const contractListId = $derived(`sidebar-client-contracts-${group.clientId}`);
	const dropPlacement = $derived(
		reorder?.dropTarget?.clientId === group.clientId && reorder.draggedClientId !== group.clientId
			? reorder.dropTarget.placement
			: null
	);

	/** Drag and keyboard reorder on the element that represents the client */
	function reorderHandlers() {
		if (!reorder) return {};
		const controller = reorder;
		return {
			draggable: true,
			'data-client-reorder-handle': group.clientId,
			'aria-keyshortcuts': 'Alt+ArrowUp Alt+ArrowDown',
			ondragstart: (event: DragEvent) => controller.dragStart(group.clientId, event, groupElement),
			ondragend: () => controller.dragEnd(),
			onkeydown: (event: KeyboardEvent) => controller.handleKeydown(group.clientId, event)
		};
	}
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

<div
	class="mb-2 border-y-2 border-transparent {dropPlacement === 'before' ? '!border-t-blue-500' : ''} {dropPlacement === 'after'
		? '!border-b-blue-500'
		: ''} {reorder?.draggedClientId === group.clientId ? 'opacity-50' : ''}"
	role="group"
	aria-label={group.clientName}
	data-testid={testId}
	data-client-id={group.clientId}
	bind:this={groupElement}
	ondragover={(event) => groupElement && reorder?.dragOver(group.clientId, event, groupElement)}
	ondrop={(event) => reorder?.drop(group.clientId, event)}
>
	{#if isSingleContract}
		{@const contract = group.contracts[0]}
		{@const isSelected = selectedContractId === contract.id}
		<button
			onclick={() => onSelect(contract.id, contract.clientId)}
			class="flex w-full items-start gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors pointer-coarse:py-3 {isSelected
				? 'bg-blue-50 text-blue-700'
				: restingRowClass}"
			class:opacity-50={!contract.isActive}
			data-contract-id={contract.id}
			data-testid="sidebar-single-contract-row"
			aria-current={isSelected ? 'page' : undefined}
			{...reorderHandlers()}
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
			class="flex items-center gap-1 pt-1 pb-0.5 text-xs font-semibold {canCollapse ? 'pr-1 pl-1.5' : 'px-3'} {holdsSelection ||
			isViewedClient
				? 'text-blue-700'
				: muted
					? 'text-stone-400'
					: 'text-stone-500'}"
			data-testid="sidebar-client-heading"
		>
			{#if onOpenClient && !muted}
				<button
					type="button"
					class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-0.5 text-left hover:bg-stone-100 pointer-coarse:py-3.5 {isViewedClient
						? 'bg-blue-50'
						: ''}"
					aria-current={isViewedClient ? 'page' : undefined}
					title="All {group.clientName} notes"
					data-testid="sidebar-client-name"
					onclick={() => onOpenClient(group.clientId)}
					{...reorderHandlers()}
				>
					<span class="inline-block h-2 w-2 flex-shrink-0 rounded-full {dotClass}" aria-hidden="true"></span>
					<span class="truncate">{group.clientName}</span>
				</button>
			{:else}
				<span class="inline-block h-2 w-2 flex-shrink-0 rounded-full {dotClass}" aria-hidden="true"></span>
				<span class="ml-1 truncate">{group.clientName}</span>
			{/if}
			{#if canCollapse}
				<button
					type="button"
					class="ml-auto flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-600 pointer-coarse:-my-3 pointer-coarse:h-11 pointer-coarse:w-8"
					aria-expanded={!isCollapsed}
					aria-controls={contractListId}
					aria-label="{isCollapsed ? 'Expand' : 'Collapse'} {group.clientName}"
					data-testid="sidebar-client-chevron"
					onclick={() => onToggleCollapse?.(group.clientId)}
				>
					<svg
						class="h-3 w-3 transition-transform {isCollapsed ? '' : 'rotate-90'}"
						viewBox="0 0 12 12"
						fill="none"
						stroke="currentColor"
						stroke-width="1.75"
						aria-hidden="true"
					>
						<path d="M4.5 2.5 8 6l-3.5 3.5" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			{/if}
		</div>
		<div id={contractListId}>
			{#each visibleContracts as contract (contract.id)}
				{@const isSelected = selectedContractId === contract.id}
				<button
					onclick={() => onSelect(contract.id, contract.clientId)}
					class="flex w-full items-center gap-2 rounded-md py-1.5 pr-3 pl-7 text-left text-sm transition-colors pointer-coarse:py-3 {isSelected
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
		</div>
	{/if}
</div>
