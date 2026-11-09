<!--
	TotalTimeModal's result (sprint 065-TT): the large total with the entry count beneath, then the
	per-contract breakdown (client · contract · time), most minutes first, contracts with time only,
	in a "By contract (N)" disclosure that starts closed so the contract list stays in view on a phone.
	While a request is out it shows a quiet "…", never the previous number as if it were new.
-->
<script lang="ts">
	import { formatMinutes } from '$lib/utils/duration';
	import type { TotalDisplay } from './total-time';

	let { display, rangeLabel }: { display: TotalDisplay; rangeLabel: string } = $props();

	/** Stays open across new totals once the person opens it */
	let isBreakdownOpen = $state(false);

	const messages: Record<Exclude<TotalDisplay['kind'], 'total' | 'loading'>, string> = {
		'no-contracts': 'No contracts selected',
		'bad-range': 'From is after To',
		offline: 'Needs a connection',
		error: "Couldn't load the total",
		empty: 'No time recorded'
	};
</script>

<section aria-live="polite" data-testid="total-time-result" data-state={display.kind}>
	<p class="text-xs font-medium text-ink-muted">Total · {rangeLabel}</p>
	{#if display.kind === 'total'}
		<p class="text-3xl font-semibold tabular-nums text-ink" data-testid="total-time-value">{formatMinutes(display.result.totalMinutes)}</p>
		<p class="text-sm text-ink-muted" data-testid="total-time-entry-count">
			{display.result.entryCount} {display.result.entryCount === 1 ? 'entry' : 'entries'}
		</p>
		<details class="mt-2" bind:open={isBreakdownOpen} data-testid="total-time-breakdown">
			<summary class="cursor-pointer text-xs text-ink-muted pointer-coarse:py-2">By contract ({display.result.contracts.length})</summary>
			<table class="mt-1 w-full text-sm">
				<tbody>
					{#each display.result.contracts as contractTotal (contractTotal.contractId)}
						<tr class="border-t border-divider" data-testid="total-time-row" data-contract-id={contractTotal.contractId}>
							<td class="py-1.5 pr-2 align-top text-xs font-semibold whitespace-nowrap text-ink-soft" title={contractTotal.clientName}>{contractTotal.clientShortCode}</td>
							<td class="w-full py-1.5 pr-2 text-ink">{contractTotal.contractName}</td>
							<td class="py-1.5 text-right whitespace-nowrap tabular-nums text-ink">{formatMinutes(contractTotal.totalMinutes)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</details>
	{:else if display.kind === 'loading'}
		<p class="text-3xl font-semibold text-ink-faint" data-testid="total-time-loading" aria-label="Loading">…</p>
	{:else}
		<p class="text-3xl font-semibold tabular-nums text-ink-faint" data-testid="total-time-value">{display.kind === 'empty' ? '0h' : '–'}</p>
		<p class="text-sm text-ink-muted" data-testid="total-time-message">{messages[display.kind]}</p>
	{/if}
</section>
