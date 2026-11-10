<!--
	TotalTimeDateToolbar (Total time r1, TT-02 / TT-04, sprint 066-TR): the quick ranges and the
	From / To date fields. Desktop: one row, presets left, the two labelled fields right, a thin rule
	below. Phone: the preset row, then From / To side by side with a gap. The preset matching the
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

<div class="flex flex-col gap-3 pb-4 md:flex-row md:border-b md:border-divider md:items-end md:justify-between md:gap-6" data-testid="total-time-toolbar">
	<div class="flex flex-wrap gap-1.5" role="group" aria-label="Quick ranges">
		{#each presets as preset (preset.key)}
			{@const isSelected = selectedPresetKey === preset.key}
			<button
				type="button"
				onclick={() => choosePreset(preset)}
				aria-pressed={isSelected}
				class={[
					'flex-1 rounded-control border px-2 py-1.5 text-sm whitespace-nowrap md:flex-none md:px-3 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:outline-none pointer-coarse:min-h-11',
					isSelected ? 'border-primary bg-primary font-medium text-on-accent' : 'border-line bg-sunken text-ink-soft hover:bg-chalk-200'
				]}
				data-testid="total-time-preset-{preset.key}"
			>{preset.label}</button>
		{/each}
	</div>
	<div class="grid grid-cols-2 gap-3 md:flex md:shrink-0 md:gap-4 md:border-l md:border-divider md:pl-6">
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
