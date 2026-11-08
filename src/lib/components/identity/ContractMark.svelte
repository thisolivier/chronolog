<!--
	Contract mark (design r1, DS-02 / DS-05, pattern tiles since sprint 063-DR): the contract's
	pattern tile cut out of the client's identity colour. Colour names the client, the pattern names
	the contract. The tile is `tileIndexForContract(contractId)` from the shared library, so every
	surface draws the same one (DS-07). Without a `contractId` it falls back to the solid square with
	the contract's initials (the 052-DR mark), so nothing breaks.
	`shape="wide"` is the timer header's pattern region: the large tile repeated edge to edge and
	cropped at 1.5 tile widths (DS-04 / DS-05).
	The outer span carries the size, rounding, selection ring and muting; the inner span carries the
	mask (a mask would also clip the ring) and opts out of forced colours, or Windows high contrast
	would paint it the page background and the mark would vanish. The wide region's tile is snapped
	to whole px (`--size-mark-timer-tile`) so WebKit draws no seams at the joins. With a `label` the mark is an image with that accessible
	name; without one it is decorative (the label text beside it names the contract).
-->
<script lang="ts">
	import { getClientDotClass, getClientMarkTextClass } from '$lib/utils/client-colors';
	import { contractInitials } from './contract-initials';
	import { TILE_MOTIFS, tileIndexForContract, tileMaskStyle } from './tile-library';

	interface Props {
		contractName: string;
		/** The contract's id: picks its pattern tile. Missing: the initials fallback */
		contractId?: string | null;
		/** The client's palette slot (`clients.color_index`) */
		colorIndex: number;
		size?: 'sm' | 'md' | 'lg';
		/** `wide`: the 1.5:1 timer header region (large tile, cropped) */
		shape?: 'square' | 'wide';
		/** Accessible name, e.g. "Amplitude / Rank Group". Omit when visible text already names it */
		label?: string;
		/** Selected contract: a pine edge around the mark */
		selected?: boolean;
		/** Quieter mark, e.g. the sidebar while Time Entries has focus */
		muted?: boolean;
	}

	let {
		contractName,
		contractId = null,
		colorIndex,
		size = 'md',
		shape = 'square',
		label,
		selected = false,
		muted = false
	}: Props = $props();

	const tileIndex = $derived(contractId ? tileIndexForContract(contractId) : null);
	const initials = $derived(contractInitials(contractName));
	const isWide = $derived(shape === 'wide' && tileIndex !== null);

	// One size class per token, as literals so Tailwind emits them
	const sizeClasses = {
		sm: 'size-(--size-mark-sm) text-[0.5rem]',
		md: 'size-(--size-mark-md) text-[0.5625rem]',
		lg: 'size-(--size-mark-lg) text-[0.75rem]'
	} as const;
	// Three initials (`RGM`) overflow the small square at 0.5rem: one step smaller (sprint 053-DR)
	const narrowSmall = $derived(tileIndex === null && size === 'sm' && initials.length > 2);
	const boxClass = $derived(
		isWide
			? 'h-(--size-mark-timer-tile) w-(--size-mark-timer-wide)'
			: narrowSmall
				? 'size-(--size-mark-sm) text-[0.4rem] tracking-tighter'
				: sizeClasses[size]
	);
</script>

<span
	class={[
		'inline-flex shrink-0 items-center justify-center rounded-mark leading-none select-none',
		boxClass,
		tileIndex === null && ['font-bold tracking-tight', getClientDotClass(colorIndex), getClientMarkTextClass(colorIndex)],
		selected && 'ring-2 ring-selection-edge ring-offset-1 ring-offset-surface',
		muted && 'opacity-60'
	]}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	data-testid="contract-mark"
	data-tile={tileIndex === null ? undefined : TILE_MOTIFS[tileIndex].id}
>
	{#if tileIndex !== null}
		<span
			class="block size-full rounded-mark forced-color-adjust-none {getClientDotClass(colorIndex)}"
			style={tileMaskStyle(tileIndex, isWide ? 'var(--size-mark-timer-tile)' : '100%', isWide ? 'repeat-x' : 'no-repeat')}
		></span>
	{:else}
		{initials}
	{/if}
</span>
