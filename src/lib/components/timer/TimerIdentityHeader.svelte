<!--
	TimerIdentityHeader — the top of the timer widget (design r1 TC-02 / SH-06, sprint 053-DR).
	Expanded: the contract's pattern region (the large tile cropped at 1.5 tile widths, DS-04 /
	DS-05, sprint 063-DR), the contract name first and the client as subtitle on the client's wash,
	and the collapse chevron on the right. No contract yet: no pattern region at all, the title
	"No contract yet" (064-DR). While running, the subtitle carries the contract picker
	(TimerContractMenu: "Select", or "Change" once chosen), which drops a menu of contracts from
	there; the chevron never chooses a contract. No running light and no RECORDING text: the
	ticking clock is the feedback (064-DR).
	Compact (`compact`): one row with the small mark, contract / client, and the clock, or
	"Finish entry" with the frozen duration for a stopped capture; the chevron expands it again.
	The parent keeps the widget body mounted (hidden) while compact, so nothing is lost.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import ContractMark from '$lib/components/identity/ContractMark.svelte';
	import { getClientBgClass } from '$lib/utils/client-colors';
	import { formatElapsedClock } from './timer-api';
	import { formatMinutes } from '$lib/utils/duration';
	import TimerContractMenu from './TimerContractMenu.svelte';
	import type { ContractOption } from '$lib/services/types';

	interface Props {
		status: 'running' | 'stopped';
		contractName: string;
		/** The capture's contract id: picks its pattern tile */
		contractId?: string | null;
		clientName: string;
		clientColorIndex: number;
		elapsedSeconds: number;
		compact?: boolean;
		/** Show the collapse / expand chevron (desktop and tablet sidebar only) */
		canCollapse?: boolean;
		onToggleCompact?: () => void;
		/** Running: the contracts the header's picker offers */
		contractOptions?: ContractOption[];
		/** Running: a contract chosen from the header's picker ("Select" / "Change") */
		onChooseContract?: (contractId: string) => void;
		/** The picker opened: refresh `contractOptions` */
		onContractMenuOpen?: () => void;
		/** Pull the wash to the widget's edges (matches the widget's own padding) */
		bleedClass?: string;
	}

	let {
		status,
		contractName,
		contractId = null,
		clientName,
		clientColorIndex,
		elapsedSeconds,
		compact = false,
		canCollapse = false,
		onToggleCompact,
		contractOptions = [],
		onChooseContract,
		onContractMenuOpen,
		bleedClass = '-mx-3 -mt-3 rounded-t-[7px]'
	}: Props = $props();

	const hasContract = $derived(Boolean(contractName));
	const contractText = $derived(hasContract ? contractName : 'No contract yet');
	const washClass = $derived(hasContract ? getClientBgClass(clientColorIndex) : 'bg-sunken');
	const frozenText = $derived(formatMinutes(Math.max(1, Math.ceil(elapsedSeconds / 60))));

	// The chevron is drawn in each layout, so toggling replaces the focused button: put focus on
	// the new one, or a keyboard user would drop to <body>
	let chevronButton = $state<HTMLButtonElement | null>(null);
	async function toggleCompact() {
		const hadFocus = document.activeElement === chevronButton;
		onToggleCompact?.();
		if (!hadFocus) return;
		await tick();
		chevronButton?.focus();
	}
</script>

{#snippet chevron()}
	{#if canCollapse}
		<button
			type="button"
			class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-chalk-950/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
			aria-label={compact ? 'Expand timer' : 'Collapse timer'}
			aria-expanded={!compact}
			data-testid="timer-collapse-toggle"
			bind:this={chevronButton}
			onclick={toggleCompact}
		>
			<svg
				class="h-3.5 w-3.5 transition-transform {compact ? '' : 'rotate-180'}"
				viewBox="0 0 12 12"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				aria-hidden="true"
			>
				<path d="M2.5 4.5 6 8l3.5-3.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>
	{/if}
{/snippet}

{#snippet mark(size: 'sm' | 'lg')}
	{#if hasContract}
		<ContractMark {contractName} {contractId} colorIndex={clientColorIndex} {size} shape={size === 'lg' ? 'wide' : 'square'} />
	{:else}
		<!-- Compact only: the expanded header has no pattern region until a contract is chosen -->
		<span class="size-(--size-mark-sm) shrink-0 rounded-mark border border-dashed border-line" aria-hidden="true"></span>
	{/if}
{/snippet}

{#if compact}
	<div class="flex items-center gap-mark-gap py-0.5 pl-0.5" data-testid="timer-compact" data-state={status}>
		{@render mark('sm')}
		<span class="flex min-w-0 flex-1 flex-col leading-tight">
			<span class="truncate text-xs font-semibold text-ink">{contractText}</span>
			{#if clientName}<span class="truncate text-[11px] text-ink-faint">{clientName}</span>{/if}
		</span>
		{#if status === 'stopped'}
			<span class="flex flex-shrink-0 flex-col items-end leading-tight">
				<span class="text-xs font-semibold text-warning">Finish entry</span>
				<span class="text-[11px] tabular-nums text-ink-muted" data-testid="timer-compact-frozen">{frozenText}</span>
			</span>
		{:else}
			<span class="flex-shrink-0 font-mono text-xs font-semibold tabular-nums text-ink" data-testid="timer-compact-clock"
				>{formatElapsedClock(elapsedSeconds)}</span
			>
		{/if}
		{@render chevron()}
	</div>
{:else}
	<div
		class="mb-3 flex items-center gap-2 py-2.5 pl-3 {canCollapse ? 'pr-1' : 'pr-3'} {bleedClass} {washClass}"
		data-testid="timer-identity"
		data-state={status}
	>
		{#if hasContract}{@render mark('lg')}{/if}
		<span class="flex min-w-0 flex-1 flex-col leading-tight">
			<span class="truncate text-sm font-semibold text-ink" data-testid="timer-identity-contract">{contractText}</span>
			<span class="flex min-h-4 min-w-0 items-baseline gap-1.5">
				{#if clientName}
					<span class="truncate text-xs text-ink-muted" data-testid="timer-identity-client">{clientName}</span>
				{/if}
				{#if onChooseContract}
					<TimerContractMenu
						contracts={contractOptions}
						selectedContractId={contractId ?? ''}
						onChoose={onChooseContract}
						onOpen={onContractMenuOpen}
					/>
				{/if}
			</span>
		</span>
		{@render chevron()}
	</div>
{/if}
