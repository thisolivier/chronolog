<!--
	SplitContentFields — one split card's content package (SP-03): description (with its [[links]])
	and the shared ontology cascade (CascadeFields). The selection lives in the split session
	(`selection()`), so Flip swaps whole packages; the overlay rebuilds this component on Flip so
	the cascade loads for the swapped contract. `cascade` is bound out: Save waits for it to settle.
-->
<script lang="ts">
	import { tick, untrack } from 'svelte';
	import WikiLinkRenderer from '$lib/components/weekly/WikiLinkRenderer.svelte';
	import CascadeFields from './CascadeFields.svelte';
	import { OntologyCascade } from './ontology-cascade.svelte';
	import { getDataService } from '$lib/services/context';
	import type { SplitContent } from './split-times';

	let {
		selection,
		idPrefix,
		contractError = '',
		disabled = false,
		cascade = $bindable()
	}: {
		selection: () => SplitContent;
		idPrefix: string;
		contractError?: string;
		disabled?: boolean;
		cascade?: OntologyCascade;
	} = $props();

	// A description with a [[link]] reads as its rendered text until clicked (then the raw field)
	let isEditingDescription = $state(false);
	let descriptionField: HTMLTextAreaElement | undefined = $state();
	const showRenderedDescription = $derived(!isEditingDescription && /\[\[[^\]]+\]\]/.test(selection().description ?? ''));

	async function editDescription() {
		isEditingDescription = true;
		await tick();
		descriptionField?.focus();
	}

	const ownCascade = untrack(() => new OntologyCascade(getDataService(), selection));
	cascade = ownCascade;
	$effect(() => {
		untrack(() => ownCascade.start());
		return () => ownCascade.dispose();
	});
</script>

<fieldset class="min-w-0 space-y-2.5" {disabled}>
	<div>
		<label for="{idPrefix}-description" class="block text-xs font-medium text-ink-muted">Description</label>
		{#if showRenderedDescription}
			<button
				type="button"
				onclick={editDescription}
				{disabled}
				class="mt-0.5 block min-h-[3.75rem] w-full rounded-control input-base px-2 py-1.5 text-left text-sm break-words whitespace-pre-line"
				title="Click to edit description"
				data-testid="{idPrefix}-description-rendered"
			>
				<WikiLinkRenderer text={selection().description ?? ''} />
			</button>
		{/if}
		<textarea
			bind:this={descriptionField}
			id="{idPrefix}-description"
			class:hidden={showRenderedDescription}
			onblur={() => (isEditingDescription = false)}
			bind:value={() => selection().description, (value) => (selection().description = value)}
			rows="2"
			class="mt-0.5 block w-full rounded-control input-base px-2 py-1.5 text-sm"
			placeholder="What are you working on?"
		></textarea>
	</div>
	<CascadeFields
		cascade={ownCascade}
		ids={{ contract: `${idPrefix}-contract`, deliverable: `${idPrefix}-deliverable`, workType: `${idPrefix}-work-type` }}
		{contractError}
	/>
</fieldset>
