<!--
	TimerIdentityHeader — the top of the timer widget (design r1 TC-02 / SH-06, sprint 053-DR).
	Expanded: the large ContractMark, the contract name first and the client as subtitle on the
	client's wash, a "Change" button that reveals the contract select (running only; the chevron
	never chooses a contract), the collapse chevron on the right, and the pulsing running light at
	the top right while running (no RECORDING text).
	Compact (`compact`): one row with the small mark, contract / client, and the clock, or
	"Finish entry" with the frozen duration for a stopped capture; the chevron expands it again.
	The parent keeps the widget body mounted (hidden) while compact, so nothing is lost.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import ContractMark from '$lib/components/identity/ContractMark.svelte';
	import TimerPulseDot from './TimerPulseDot.svelte';
	import { getClientBgClass } from '$lib/utils/client-colors';
	import { formatElapsedClock } from './timer-api';
	import { formatMinutes } from '$lib/utils/duration';

	interface Props {
		status: 'running' | 'stopped';
		contractName: string;
		clientName: string;
		clientColorIndex: number;
		elapsedSeconds: number;
		compact?: boolean;
		/** Show the collapse / expand chevron (desktop and tablet sidebar only) */
		canCollapse?: boolean;
		onToggleCompact?: () => void;
		/** Running with a contract: the "Change" button that reveals the contract select */
		onChangeContract?: () => void;
		isChangingContract?: boolean;
		/** Pull the wash to the widget's edges (matches the widget's own padding) */
		bleedClass?: string;
	}

	let {
		status,
		contractName,
		clientName,
		clientColorIndex,
		elapsedSeconds,
		compact = false,
		canCollapse = false,
		onToggleCompact,
		onChangeContract,
		isChangingContract = false,
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
		<ContractMark {contractName} colorIndex={clientColorIndex} {size} />
	{:else}
		<span
			class="{size === 'lg' ? 'size-(--size-mark-lg)' : 'size-(--size-mark-sm)'} shrink-0 rounded-mark border border-dashed border-line"
			aria-hidden="true"
		></span>
	{/if}
{/snippet}

{#if compact}
	<div class="relative flex items-center gap-mark-gap py-0.5 pl-0.5" data-testid="timer-compact" data-state={status}>
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
			<TimerPulseDot class="absolute -top-1.5 -right-1.5" />
		{/if}
		{@render chevron()}
	</div>
{:else}
	<div
		class="relative mb-3 flex items-center gap-2.5 py-2.5 pr-3 pl-3 {bleedClass} {washClass}"
		data-testid="timer-identity"
		data-state={status}
	>
		{@render mark('lg')}
		<span class="flex min-w-0 flex-1 flex-col leading-tight">
			<span class="truncate text-sm font-semibold text-ink" data-testid="timer-identity-contract">{contractText}</span>
			<span class="flex min-h-4 min-w-0 items-baseline gap-1.5">
				{#if clientName}
					<span class="truncate text-xs text-ink-muted" data-testid="timer-identity-client">{clientName}</span>
				{/if}
				{#if onChangeContract && hasContract && !isChangingContract}
					<button
						type="button"
						class="flex-shrink-0 rounded text-xs font-medium text-pine-700 underline decoration-pine-300 underline-offset-2 hover:text-pine-900 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
						aria-label="Change contract"
						data-testid="timer-change-contract"
						onclick={onChangeContract}
					>
						Change
					</button>
				{/if}
			</span>
		</span>
		{@render chevron()}
		{#if status === 'running'}
			<TimerPulseDot class="absolute top-1.5 right-1.5" />
		{/if}
	</div>
{/if}
