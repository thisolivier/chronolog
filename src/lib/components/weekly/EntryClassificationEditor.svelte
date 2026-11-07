<!--
	EntryClassificationEditor — a time entry's inline deliverable / work type pickers, driven by the
	shared OntologyCascade (design r1 IN-03, TC-05; 055-DR follow-up adopted at checkpoint B/C), so
	inline editing follows the same rules as the completion form and the Add Time Entry modal:
	both levels always drawn, "Not applicable" when a parent has no options, a failed load keeps
	the held value with Retry, and a deliverable pick takes the sole work type for the user.

	Inline semantics are kept: every pick is saved at once (after the cascade settles, so the pair
	is never stale); Done, Enter or Escape closes. The editor opens on the entry's own values, with
	an empty deliverable / work type as an explicit "none", so opening it never picks anything by
	itself (a contract change opens it set to none: the change cleared the chain).
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { getDataService } from '$lib/services/context';
	import CascadeSelect from '$lib/components/timer/CascadeSelect.svelte';
	import { OntologyCascade, type CascadeSelection } from '$lib/components/timer/ontology-cascade.svelte';
	import { CASCADE_NONE, cascadeIdForSave } from '$lib/components/timer/ontology-cascade';

	let {
		contractId,
		deliverableId,
		workTypeId,
		onSave,
		onDone,
		element = $bindable()
	}: {
		contractId: string;
		deliverableId: string | null;
		workTypeId: string | null;
		/** Persist a pick: the deliverable and work type to store (null for none) */
		onSave: (fields: { deliverableId: string | null; workTypeId: string | null }) => void;
		/** Done, Enter or Escape */
		onDone: () => void;
		/** The editor's container, so the card can focus it (or the first enabled select inside) */
		element?: HTMLElement;
	} = $props();

	const dataService = getDataService();

	let selection = $state<CascadeSelection>(
		untrack(() => ({
			contractId,
			deliverableId: deliverableId || CASCADE_NONE,
			workTypeId: workTypeId || CASCADE_NONE
		}))
	);
	const cascade = new OntologyCascade(dataService, () => selection);

	$effect(() => {
		untrack(() => cascade.start());
		return () => cascade.dispose();
	});

	function savedFields() {
		return {
			deliverableId: cascadeIdForSave(selection.deliverableId) || null,
			workTypeId: cascadeIdForSave(selection.workTypeId) || null
		};
	}

	async function chooseDeliverable(nextDeliverableId: string) {
		await cascade.chooseDeliverable(nextDeliverableId);
		await cascade.settled();
		onSave(savedFields());
	}

	function chooseWorkType(nextWorkTypeId: string) {
		cascade.chooseWorkType(nextWorkTypeId);
		onSave(savedFields());
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' || event.key === 'Enter') {
			event.preventDefault();
			onDone();
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={element}
	tabindex="-1"
	class="entry-compact-select flex min-w-0 flex-1 items-center gap-1.5 focus:outline-none"
	onkeydown={handleKeydown}
	data-testid="entry-classification-editor"
>
	<div class="min-w-0 flex-1">
		<CascadeSelect
			level="deliverable"
			ariaLabel="Deliverable"
			state={cascade.deliverable}
			value={selection.deliverableId}
			onChoose={chooseDeliverable}
			onRetry={() => cascade.retry('deliverable')}
		/>
	</div>
	<div class="min-w-0 flex-1">
		<CascadeSelect
			level="workType"
			ariaLabel="Work type"
			state={cascade.workType}
			value={selection.workTypeId}
			onChoose={chooseWorkType}
			onRetry={() => cascade.retry('workType')}
		/>
	</div>
	<button onclick={onDone} class="shrink-0 rounded-control px-2 py-0.5 text-xs btn-secondary" type="button">Done</button>
</div>

<style>
	/* The row keeps its height while editing (TR-06): the same 1.5rem pickers as the card's contract editor */
	.entry-compact-select :global(select) {
		height: 1.5rem;
		padding-block: 0;
		line-height: 1.25rem;
	}
</style>
