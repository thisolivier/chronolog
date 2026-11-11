<!--
	TotalTimeModal's result (sprint 065-TT; r1 layout TT-06 / TT-12, sprint 066-TR): the big pine
	total with the entry count beneath, then "By contract", open by default (the modal keeps the
	state, so once toggled a new total never forces it open again). Each row: the contract's pattern
	mark in its client colour, the contract name, the client beneath (the breakdown is not grouped),
	the time right-aligned; thin rules, no cards; most minutes first, contracts with time only.
	Desktop: the rows scroll under the total. While a request is out it shows a quiet "…", never the
	previous number; no selection is "–" and "No contracts selected"; a selection with no time is
	"0h", "0 entries"; a failed load offers Try again.
-->
<script lang="ts">
	import ContractMark from '$lib/components/identity/ContractMark.svelte';
	import { formatMinutes } from '$lib/utils/duration';
	import type { TotalDisplay } from './total-time';

	let {
		display,
		colorIndexFor,
		isBreakdownOpen = $bindable(true),
		onRetry
	}: {
		display: TotalDisplay;
		/** The client colour slot of a contract in the breakdown */
		colorIndexFor: (contractId: string) => number;
		isBreakdownOpen?: boolean;
		onRetry: () => void;
	} = $props();

	const messages: Record<Exclude<TotalDisplay['kind'], 'total' | 'loading'>, string> = {
		'no-contracts': 'No contracts selected',
		'bad-range': 'From is after To',
		offline: 'Needs a connection',
		error: "Couldn't load the total",
		empty: 'No time recorded'
	};
	const totalClass = 'text-5xl leading-none font-bold tracking-tight tabular-nums md:text-6xl';
</script>

<section class="flex flex-col md:min-h-0 md:flex-1" aria-live="polite" aria-label="Total" data-testid="total-time-result" data-state={display.kind}>
	<div class="shrink-0 pb-4">
		{#if display.kind === 'total'}
			<p class="{totalClass} text-primary" data-testid="total-time-value">{formatMinutes(display.result.totalMinutes)}</p>
			<p class="mt-1.5 text-base text-ink-muted" data-testid="total-time-entry-count">
				{display.result.entryCount} {display.result.entryCount === 1 ? 'entry' : 'entries'}
			</p>
		{:else if display.kind === 'loading'}
			<p class="{totalClass} text-ink-faint" data-testid="total-time-loading" aria-label="Loading">…</p>
			<p class="mt-1.5 text-base text-transparent" aria-hidden="true">–</p>
		{:else if display.kind === 'empty'}
			<p class="{totalClass} text-primary" data-testid="total-time-value">{formatMinutes(0)}</p>
			<p class="mt-1.5 text-base text-ink-muted" data-testid="total-time-entry-count">0 entries</p>
			<p class="mt-1 text-sm text-ink-faint" data-testid="total-time-message">{messages.empty}</p>
		{:else}
			<p class="{totalClass} text-ink-faint" data-testid="total-time-value">–</p>
			<p class="mt-1.5 text-base text-ink-muted" data-testid="total-time-message">{messages[display.kind]}</p>
			{#if display.kind === 'error' || display.kind === 'offline'}
				<button
					type="button"
					onclick={onRetry}
					class="mt-2 rounded-control btn-secondary px-3 py-1 text-sm pointer-coarse:min-h-11"
					data-testid="total-time-retry"
				>Try again</button>
			{/if}
		{/if}
	</div>

	{#if display.kind === 'total'}
		<div class="flex flex-col border-t border-divider md:min-h-0 md:flex-1" data-testid="total-time-breakdown" data-open={isBreakdownOpen}>
			<button
				type="button"
				class="flex shrink-0 items-center gap-2 rounded-control py-2.5 text-left text-base font-semibold text-ink-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none pointer-coarse:min-h-11"
				aria-expanded={isBreakdownOpen}
				aria-controls="total-time-breakdown-rows"
				onclick={() => (isBreakdownOpen = !isBreakdownOpen)}
				data-testid="total-time-breakdown-toggle"
			>
				<span class={['inline-block text-xs transition-transform', !isBreakdownOpen && '-rotate-90']} aria-hidden="true">▼</span>
				By contract
			</button>
			<ul id="total-time-breakdown-rows" class="border-t border-divider md:min-h-0 md:flex-1 touch-pan-y md:overflow-y-auto md:overscroll-contain" hidden={!isBreakdownOpen}>
				{#each display.result.contracts as contractTotal (contractTotal.contractId)}
					<li class="flex items-center gap-3 border-b border-divider py-3 pr-1" data-testid="total-time-row" data-contract-id={contractTotal.contractId}>
						<ContractMark contractName={contractTotal.contractName} contractId={contractTotal.contractId} colorIndex={colorIndexFor(contractTotal.contractId)} size="lg" />
						<span class="min-w-0 flex-1">
							<span class="block font-semibold break-words text-ink">{contractTotal.contractName}</span>
							{#if contractTotal.clientName !== contractTotal.contractName}
								<span class="block text-sm text-ink-muted">{contractTotal.clientName}</span>
							{/if}
						</span>
						<span class="shrink-0 text-lg font-bold whitespace-nowrap tabular-nums text-primary">{formatMinutes(contractTotal.totalMinutes)}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</section>
