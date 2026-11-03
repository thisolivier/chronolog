<script lang="ts">
	import SettingsShell from '$lib/components/admin/SettingsShell.svelte';

	let { children } = $props();
</script>

<SettingsShell>
	{@render children()}
</SettingsShell>
