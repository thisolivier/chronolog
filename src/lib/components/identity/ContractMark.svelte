<!--
	Contract mark (design r1, DS-02 / DS-05): a solid square in the client's identity colour with
	the contract's initials. Colour names the client, initials name the contract. Pattern tiles
	(DS-03 / DS-04 / DS-07) are deferred; this is the minimal mark the owner chose on 2026-11-07.
	Sizes come from the `--size-mark-*` tokens. With a `label` the mark is an image with that
	accessible name; without one it is decorative (the label text beside it names the contract).
-->
<script lang="ts">
	import { getClientDotClass, getClientMarkTextClass } from '$lib/utils/client-colors';
	import { contractInitials } from './contract-initials';

	interface Props {
		contractName: string;
		/** The client's palette slot (`clients.color_index`) */
		colorIndex: number;
		size?: 'sm' | 'md' | 'lg';
		/** Accessible name, e.g. "Amplitude / Rank Group". Omit when visible text already names it */
		label?: string;
		/** Selected contract: a pine edge around the mark */
		selected?: boolean;
		/** Quieter mark, e.g. the sidebar while Time Entries has focus */
		muted?: boolean;
	}

	let { contractName, colorIndex, size = 'md', label, selected = false, muted = false }: Props = $props();

	const initials = $derived(contractInitials(contractName));

	// One size class per token, as literals so Tailwind emits them
	const sizeClasses = {
		sm: 'size-(--size-mark-sm) text-[0.5rem]',
		md: 'size-(--size-mark-md) text-[0.5625rem]',
		lg: 'size-(--size-mark-lg) text-[0.75rem]'
	} as const;
</script>

<span
	class={[
		'inline-flex shrink-0 items-center justify-center rounded-mark leading-none font-bold tracking-tight select-none',
		sizeClasses[size],
		getClientDotClass(colorIndex),
		getClientMarkTextClass(colorIndex),
		selected && 'ring-2 ring-selection-edge ring-offset-1 ring-offset-surface',
		muted && 'opacity-60'
	]}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	data-testid="contract-mark"
>
	{initials}
</span>
