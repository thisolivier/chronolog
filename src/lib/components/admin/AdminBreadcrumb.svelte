<script lang="ts">
	interface BreadcrumbItem {
		label: string;
		href?: string;
	}

	let { items }: { items: BreadcrumbItem[] } = $props();
</script>

<nav class="flex flex-wrap items-center gap-2 text-sm text-ink-faint" aria-label="Breadcrumb">
	<a href="/settings" class="hover:text-ink-soft">Settings</a>
	{#each items as item (item.label)}
		<span class="text-ink-faint">/</span>
		{#if item.href}
			<a href={item.href} class="hover:text-ink-soft">{item.label}</a>
		{:else}
			<span class="font-medium text-ink">{item.label}</span>
		{/if}
	{/each}
</nav>
