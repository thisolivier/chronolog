<script lang="ts">
	/**
	 * Confirm dialog for deletes that could touch recorded work (sprint 026-CL, findings 1 and 20).
	 * States the real counts. When there is work and an archive action exists, "Archive" is the
	 * default (focused, primary) and deleting is the secondary, explicitly named choice.
	 */
	import { enhance } from '$app/forms';
	import { describeUsage, hasRecordedWork, type UsageSummaryInput } from '$lib/utils/usage-summary';

	interface Props {
		title: string;
		usage: UsageSummaryInput;
		/** Form action for Archive; omit when the item cannot be archived (deliverables). */
		archiveAction?: string;
		deleteAction: string;
		/** Label of the destructive button when there is recorded work. */
		deleteWithWorkLabel?: string;
		/** What happens to the work on delete, shown under the counts. */
		deleteConsequence: string;
		hiddenFields: Record<string, string>;
		onClose: () => void;
	}

	let {
		title,
		usage,
		archiveAction,
		deleteAction,
		deleteWithWorkLabel = 'Delete and reassign',
		deleteConsequence,
		hiddenFields,
		onClose
	}: Props = $props();

	const usageText = $derived(describeUsage(usage));
	const hasWork = $derived(hasRecordedWork(usage));
	const offerArchive = $derived(hasWork && Boolean(archiveAction));

	let isSubmitting = $state(false);
	let defaultButton = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		defaultButton?.focus();
	});

	function submitEnhancement() {
		isSubmitting = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			isSubmitting = false;
			onClose();
		};
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
	role="presentation"
	onclick={(event) => event.target === event.currentTarget && onClose()}
>
	<div
		class="w-full max-w-md rounded-lg bg-white p-5 text-left shadow-xl"
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="delete-impact-title"
		aria-describedby="delete-impact-body"
		data-testid="delete-impact-dialog"
	>
		<h2 id="delete-impact-title" class="text-base font-semibold text-stone-900">{title}</h2>
		<div id="delete-impact-body" class="mt-2 space-y-2 text-sm text-stone-600">
			{#if hasWork}
				<p data-testid="delete-impact-counts">
					It has <strong class="text-stone-900">{usageText}</strong>.
				</p>
				{#if offerArchive}
					<p>
						<strong class="text-stone-800">Archive</strong> moves it to Archived at the bottom of the
						sidebar and out of selects, and keeps everything; you can restore it later.
					</p>
				{/if}
				<p>{deleteConsequence}</p>
			{:else}
				<p>
					{usage.contractCount ? `It has ${usageText} but no` : 'It has no'} time entries or notes, so
					nothing else is affected.
				</p>
			{/if}
		</div>

		<div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
			<button
				type="button"
				onclick={onClose}
				class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
			>
				Cancel
			</button>
			<form method="POST" action={deleteAction} use:enhance={submitEnhancement}>
				{#each Object.entries(hiddenFields) as [fieldName, fieldValue] (fieldName)}
					<input type="hidden" name={fieldName} value={fieldValue} />
				{/each}
				{#if offerArchive}
					<button
						type="submit"
						disabled={isSubmitting}
						class="w-full rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 sm:w-auto"
					>
						{deleteWithWorkLabel}
					</button>
				{:else}
					<button
						type="submit"
						bind:this={defaultButton}
						disabled={isSubmitting}
						class="w-full rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 sm:w-auto"
					>
						{hasWork ? deleteWithWorkLabel : 'Delete'}
					</button>
				{/if}
			</form>
			{#if offerArchive && archiveAction}
				<form method="POST" action={archiveAction} use:enhance={submitEnhancement}>
					{#each Object.entries(hiddenFields) as [fieldName, fieldValue] (fieldName)}
						<input type="hidden" name={fieldName} value={fieldValue} />
					{/each}
					<button
						type="submit"
						bind:this={defaultButton}
						disabled={isSubmitting}
						class="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
					>
						Archive
					</button>
				</form>
			{/if}
		</div>
	</div>
</div>
