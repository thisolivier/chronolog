<script lang="ts">
	/** Success / error banner for admin form actions: always the specific message from the server. */
	let { form }: { form: { error?: string; message?: string } | null | undefined } = $props();
</script>

{#if form?.error}
	<div class="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert" data-testid="admin-error">
		{form.error}
	</div>
{:else if form?.message}
	<div class="rounded-md bg-green-50 p-3 text-sm text-green-700" role="status" data-testid="admin-success">
		{form.message}
	</div>
{/if}
