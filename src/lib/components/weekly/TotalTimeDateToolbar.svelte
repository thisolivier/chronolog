<!--
	TotalTimeDateToolbar (Total time r1, TT-02 / TT-04, sprint 066-TR): the quick ranges and the
	From / To date fields. The chips never wrap. Desktop: one row, presets left, the two labelled
	fields right, a thin rule below; in a narrow window the fields move under the chips (still
	right-aligned). Phone: one preset row (the chips share the width, and scroll sideways with the
	scrollbar hidden when the viewed week's chip makes five), then From / To side by side, each half
	the width (appearance reset so iOS lets them shrink; see the style block). The preset matching the
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
		'total-time-date mt-0.5 block w-full rounded-control bg-surface px-2.5 py-1.5 text-sm text-ink input-base md:w-40',
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
		class="-mr-4 -ml-1 flex touch-manipulation flex-nowrap gap-1.5 overflow-x-auto overscroll-x-contain py-1 pl-1 [scrollbar-width:none] after:w-4 after:shrink-0 after:content-[''] md:mx-0 md:overflow-visible md:p-0 md:after:hidden [&::-webkit-scrollbar]:hidden"
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
	<div class="flex gap-3 md:ml-auto md:shrink-0 md:gap-4 md:border-l md:border-divider md:pl-6">
		<label class="block min-w-0 flex-1 text-xs font-medium text-ink-muted md:flex-none">From
			<input
				type="date"
				bind:value={fromDate}
				max={toDate || undefined}
				aria-invalid={isBackwards || undefined}
				class={fieldClass}
				data-testid="total-time-from"
			/>
		</label>
		<label class="block min-w-0 flex-1 text-xs font-medium text-ink-muted md:flex-none">To
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

<style>
	/*
	 * iOS Safari gives a native date input an intrinsic width it will not shrink below and ignores
	 * `width` until the appearance is reset, so From and To collided on a phone (066-TR follow-up).
	 * Phone width only: desktop keeps the native look. The font stays at 16px (app.css), so iOS
	 * does not zoom; the empty field keeps its height and the value sits left.
	 */
	@media (max-width: 767px) {
		.total-time-date {
			display: block;
			width: 100%;
			min-width: 0;
			min-height: 2.75rem;
			-webkit-appearance: none;
			appearance: none;
		}
		.total-time-date::-webkit-date-and-time-value {
			text-align: left;
		}
	}
</style>
