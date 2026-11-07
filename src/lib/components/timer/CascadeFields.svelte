<!--
	CascadeFields — Contract, Deliverable and Work type rows driven by one OntologyCascade (sprint
	055-DR, IN-03). Every row is always drawn with its label, so a dependent level never pops in
	or moves the rest of the form (TC-04/TC-05). Used by TimerCompletionForm and
	AddTimeEntryModal; the timesheet's inline editors can adopt it in stage 6.
-->
<script lang="ts">
	import CascadeSelect from './CascadeSelect.svelte';
	import type { OntologyCascade } from './ontology-cascade.svelte';

	let {
		cascade,
		ids,
		contractError = '',
		size = 'compact'
	}: {
		cascade: OntologyCascade;
		/** Element ids of the three selects (kept from the forms that existed before, for tests and labels) */
		ids: { contract: string; deliverable: string; workType: string };
		/** "Pick a contract" after a Save without one */
		contractError?: string;
		size?: 'compact' | 'regular';
	} = $props();

	const labelClass = 'block text-xs font-medium text-ink-muted';
</script>

<div>
	<label for={ids.contract} class={labelClass}>Contract</label>
	<div class="mt-0.5">
		<CascadeSelect
			level="contract"
			id={ids.contract}
			state={cascade.contract}
			value={cascade.selection.contractId}
			onChoose={(contractId) => cascade.chooseContract(contractId)}
			onRetry={() => cascade.retry('contract')}
			invalid={contractError !== ''}
			errorId={contractError ? `${ids.contract}-error` : undefined}
			{size}
		/>
	</div>
	{#if contractError}<p id="{ids.contract}-error" class="mt-1 text-xs text-rust-600" role="alert">{contractError}</p>{/if}
</div>

<div>
	<label for={ids.deliverable} class={labelClass}>Deliverable</label>
	<div class="mt-0.5">
		<CascadeSelect
			level="deliverable"
			id={ids.deliverable}
			state={cascade.deliverable}
			value={cascade.selection.deliverableId}
			onChoose={(deliverableId) => cascade.chooseDeliverable(deliverableId)}
			onRetry={() => cascade.retry('deliverable')}
			{size}
		/>
	</div>
</div>

<div>
	<label for={ids.workType} class={labelClass}>Work type</label>
	<div class="mt-0.5">
		<CascadeSelect
			level="workType"
			id={ids.workType}
			state={cascade.workType}
			value={cascade.selection.workTypeId}
			onChoose={(workTypeId) => cascade.chooseWorkType(workTypeId)}
			onRetry={() => cascade.retry('workType')}
			{size}
		/>
	</div>
</div>
