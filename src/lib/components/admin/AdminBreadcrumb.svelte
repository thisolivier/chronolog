<script lang="ts">
	interface BreadcrumbItem {
		label: string;
		href?: string;
	}

	let { items }: { items: BreadcrumbItem[] } = $props();
</script>

<nav class="flex items-center gap-2 text-sm text-gray-500">
	<a href="/admin" class="hover:text-gray-700">Admin</a>
	{#each items as item, index}
		<span class="text-gray-400">/</span>
		{#if item.href}
			<a href={item.href} class="hover:text-gray-700">{item.label}</a>
		{:else}
			<span class="font-medium text-gray-900">{item.label}</span>
		{/if}
	{/each}
</nav>
