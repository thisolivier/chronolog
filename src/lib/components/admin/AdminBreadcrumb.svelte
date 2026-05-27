<script lang="ts">
	interface BreadcrumbItem {
		label: string;
		href?: string;
	}

	let { items }: { items: BreadcrumbItem[] } = $props();
</script>

<nav class="flex items-center gap-2 text-sm text-stone-500">
	<a href="/admin" class="hover:text-stone-700">Admin</a>
	{#each items as item (item.label)}
		<span class="text-stone-400">/</span>
		{#if item.href}
			<a href={item.href} class="hover:text-stone-700">{item.label}</a>
		{:else}
			<span class="font-medium text-stone-900">{item.label}</span>
		{/if}
	{/each}
</nav>
