<!--
	SidebarClientGroup — one client in the contracts sidebar (sprint 026 grouping, 033 collapse,
	design r1 SH-02 restyle in 053-DR).
	Two or more contracts: a pale tinted section (the `sunken` token) holding the client heading and
	its contracts. The heading is the client's name (no colour dot: colour lives in the contract
	marks), which opens the client view (`/notes/client/<id>`), and at the right edge a chevron
	(collapse; sprint 039-CL) in one column with the Archived chevron (051-UI). A collapsed client
	still shows its open contract. Each contract row is a ContractMark (the contract's pattern tile
	in the client colour), the name at the mark-gap token, and the note count at the right. The
	selected contract is a punch-out in the surface colour, not a blue wash, and only it gets the
	quiet repeat of its tile between the name and the count (DS-04, sprint 063-DR).
	Exactly one contract: a single flattened row at the outer inset (the owner-selected looser
	alignment: it does not line up with the marks inside the tinted groups), with the mark, the
	contract name and the client name beneath it in small muted text.
	`muted` draws the same grammar quieter for the Archived section (no chevron, no client view).
	Inactive and archived contracts are muted by colour, never by opacity, so the Time Entries
	mute (one 50% wrapper, SH-03) never stacks to 25%; `sectionMuted` says that wrapper is on.
	`reorder` (active clients only) makes the heading or single row draggable and moves it with
	Alt+ArrowUp / Alt+ArrowDown.
-->
<script lang="ts">
	import ContractMark from '$lib/components/identity/ContractMark.svelte';
	import ContractTileRepeat from '$lib/components/identity/ContractTileRepeat.svelte';
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
		reorder,
		sectionMuted = false
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
		/** The whole Notes section is at 50% (Time Entries selected): no extra opacity inside it */
		sectionMuted?: boolean;
	} = $props();

	let groupElement = $state<HTMLElement | null>(null);

	const isSingleContract = $derived(group.contracts.length === 1);
	const isViewedClient = $derived(viewedClientId === group.clientId);
	// Resting rows sit on the tint (grouped) or the sidebar canvas (flattened); hover darkens a step
	const restingRowClass = $derived(muted ? 'text-ink-faint hover:bg-chalk-200/70' : 'text-ink-soft hover:bg-chalk-200/70');
	// The punch-out: the surface colour with a soft edge, so it reads on the tint and on the canvas
	const selectedRowClass = 'bg-surface font-medium text-ink shadow-panel ring-1 ring-divider';
	/** Archived or inactive marks are quieter, unless the whole section is already muted */
	const markMuted = (isActive: boolean) => (muted || !isActive) && !sectionMuted;
	const rowTextClass = (isActive: boolean, isSelected: boolean) =>
		isSelected ? selectedRowClass : isActive ? restingRowClass : `${muted ? '' : 'hover:bg-chalk-200/70'} text-ink-fainter`;
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
			class="flex-shrink-0 text-[11px] tabular-nums text-ink-faint"
			title="{count} {count === 1 ? 'note' : 'notes'}"
			data-testid="sidebar-note-count"
		>
			{count}
		</span>
	{/if}
{/snippet}

{#snippet inactiveMark(isActive: boolean)}
	{#if !isActive}
		<span class="ml-1 text-xs text-ink-faint">(inactive)</span>
	{/if}
{/snippet}

<div
	class="mb-2 border-y-2 border-transparent {isSingleContract ? '' : 'rounded-panel bg-sunken px-1 pb-1'} {dropPlacement === 'before' ? '!border-t-pine-500' : ''} {dropPlacement === 'after'
		? '!border-b-pine-500'
		: ''} {reorder?.draggedClientId === group.clientId ? 'outline-2 outline-offset-1 outline-pine-400 outline-dashed' : ''}"
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
			class="flex w-full items-start gap-mark-gap rounded-control px-3 py-1.5 text-left text-sm transition-colors pointer-coarse:py-3 {rowTextClass(
				contract.isActive,
				isSelected
			)}"
			data-contract-id={contract.id}
			data-testid="sidebar-single-contract-row"
			aria-current={isSelected ? 'page' : undefined}
			{...reorderHandlers()}
		>
			<span class="mt-0.5 flex">
				<ContractMark
					contractName={contract.name}
					contractId={contract.id}
					colorIndex={group.clientColorIndex}
					size="sm"
					muted={markMuted(contract.isActive)}
				/>
			</span>
			<span class="min-w-0 truncate {isSelected ? '' : 'flex-1'}">{contract.name}{@render inactiveMark(contract.isActive)}<span
					class="block truncate text-[11px] leading-4 font-normal {isSelected ? 'text-ink-muted' : 'text-ink-faint'}"
					data-testid="sidebar-row-client-name">{group.clientName}</span
				></span>
			{#if isSelected}
				<ContractTileRepeat contractId={contract.id} colorIndex={group.clientColorIndex} absorbGap class="mt-0.5" />
			{/if}
			<span class="mt-0.5">{@render noteCount(contract.noteCount)}</span>
		</button>
	{:else}
		<div
			class="flex items-center gap-1 pt-1 pb-0.5 text-sm font-semibold {canCollapse ? 'pl-2' : 'px-3.5'} {muted
				? 'text-ink-faint'
				: 'text-ink'}"
			data-testid="sidebar-client-heading"
		>
			{#if onOpenClient && !muted}
				<button
					type="button"
					class="flex min-w-0 flex-1 items-center gap-2 rounded-control px-1.5 py-0.5 text-left hover:bg-chalk-200/70 pointer-coarse:py-3.5 {isViewedClient
						? selectedRowClass
						: ''}"
					aria-current={isViewedClient ? 'page' : undefined}
					title="All {group.clientName} notes"
					data-testid="sidebar-client-name"
					onclick={() => onOpenClient(group.clientId)}
					{...reorderHandlers()}
				>
					<span class="truncate">{group.clientName}</span>
				</button>
			{:else}
				<span class="truncate">{group.clientName}</span>
			{/if}
			{#if canCollapse}
				<button
					type="button"
					class="ml-auto flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-chalk-200/70 hover:text-ink-muted pointer-coarse:-my-3 pointer-coarse:h-11 pointer-coarse:w-8"
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
					class="flex w-full items-center gap-mark-gap rounded-control py-1.5 pr-2 pl-3.5 text-left text-sm transition-colors pointer-coarse:py-3 {rowTextClass(
						contract.isActive,
						isSelected
					)}"
					data-contract-id={contract.id}
					aria-current={isSelected ? 'page' : undefined}
				>
					<ContractMark
						contractName={contract.name}
						contractId={contract.id}
						colorIndex={group.clientColorIndex}
						size="sm"
						muted={markMuted(contract.isActive)}
					/>
					<span class="min-w-0 truncate {isSelected ? '' : 'flex-1'}">{contract.name}{@render inactiveMark(contract.isActive)}</span>
					{#if isSelected}
						<ContractTileRepeat contractId={contract.id} colorIndex={group.clientColorIndex} absorbGap />
					{/if}
					{@render noteCount(contract.noteCount)}
				</button>
			{/each}
		</div>
	{/if}
</div>
