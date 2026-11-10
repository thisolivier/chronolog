<!--
	TotalTimeDateToolbar (Total time r1, TT-02 / TT-04, sprint 066-TR): the quick ranges and the
	From / To date fields. The chips never wrap. Desktop: one row, presets left, the two labelled
	fields right, a thin rule below; in a narrow window the fields move under the chips (still
	right-aligned). Phone: one preset row (the chips share the width, and scroll sideways with the
	scrollbar hidden when the viewed week's chip makes five), then From / To side by side. The preset matching the
	range is pressed (the app's pine selected style). From after To marks both fields; the typed
	values stay for correction (no swap). Native date inputs, as before.
-->
<script lang="ts">
	import type { RangePreset } from './total-time';

	let {
		presets,
		selectedPresetKey,
		fromDate = $bindable(),
		toDate = $bindable(),
		isBackwards
	}: {
		presets: RangePreset[];
		selectedPresetKey: string | null;
		fromDate: string;
		toDate: string;
		/** From is after To: both fields are marked invalid */
		isBackwards: boolean;
	} = $props();

	const fieldClass = $derived([
		'mt-0.5 block w-full rounded-control bg-surface px-2.5 py-1.5 text-sm text-ink input-base md:w-40',
		isBackwards && 'border-danger focus:border-danger focus:ring-danger'
	]);

	function choosePreset(preset: RangePreset) {
		fromDate = preset.range.from;
		toDate = preset.range.to;
	}
</script>

<div class="flex flex-col gap-3 pb-4 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-x-6 md:gap-y-3 md:border-b md:border-divider" data-testid="total-time-toolbar">
	<!-- Never wraps: scrolls sideways on a phone (scrollbar hidden, a spacer after the last chip); on desktop the dates wrap instead -->
	<div
		class="-mr-4 -ml-1 flex flex-nowrap gap-1.5 overflow-x-auto py-1 pl-1 [scrollbar-width:none] after:w-4 after:shrink-0 after:content-[''] md:mx-0 md:overflow-visible md:p-0 md:after:hidden [&::-webkit-scrollbar]:hidden"
		role="group"
		aria-label="Quick ranges"
		data-testid="total-time-presets"
	>
		{#each presets as preset (preset.key)}
			{@const isSelected = selectedPresetKey === preset.key}
			<button
				type="button"
				onclick={() => choosePreset(preset)}
				aria-pressed={isSelected}
				class={[
					'shrink-0 grow rounded-control border px-2.5 py-1.5 text-sm whitespace-nowrap md:grow-0 md:px-3 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:outline-none pointer-coarse:min-h-11',
					isSelected ? 'border-primary bg-primary font-medium text-on-accent' : 'border-line bg-sunken text-ink-soft hover:bg-chalk-200'
				]}
				data-testid="total-time-preset-{preset.key}"
			>{preset.label}</button>
		{/each}
	</div>
	<div class="grid grid-cols-2 gap-3 md:ml-auto md:flex md:shrink-0 md:gap-4 md:border-l md:border-divider md:pl-6">
		<label class="block min-w-0 text-xs font-medium text-ink-muted">From
			<input
				type="date"
				bind:value={fromDate}
				max={toDate || undefined}
				aria-invalid={isBackwards || undefined}
				class={fieldClass}
				data-testid="total-time-from"
			/>
		</label>
		<label class="block min-w-0 text-xs font-medium text-ink-muted">To
			<input
				type="date"
				bind:value={toDate}
				min={fromDate || undefined}
				aria-invalid={isBackwards || undefined}
				class={fieldClass}
				data-testid="total-time-to"
			/>
		</label>
	</div>
</div>
