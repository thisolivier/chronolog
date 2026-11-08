<!--
	Quiet contract repeat (design r1 DS-03 / DS-04, sprint 063-DR): the contract's own pattern tile,
	repeated edge to edge at the small tile size in the client colour at reduced opacity, filling the
	free space of a row (the selected sidebar contract, the notes list header, the note editor
	header). Decorative only: `aria-hidden`, never any text. It is a flex item that grows into the
	space left and shrinks to zero before anything else in the row (`flex-1 min-w-0`), so it never
	squeezes a label or a control. The end is clipped mid-tile; the tile is never stretched. The tile
	size is whole px (`--size-tile-repeat`), and the span opts out of forced colours.
	`absorbGap`: the repeat swallows one of its row's flex gaps (negative margin, the same padding,
	background clipped to the content), so a repeat squeezed to nothing leaves a single gap behind.
-->
<script lang="ts">
	import { getClientDotClass } from '$lib/utils/client-colors';
	import { TILE_MOTIFS, tileIndexForContract, tileMaskStyle } from './tile-library';

	interface Props {
		contractId: string;
		/** The client's palette slot (`clients.color_index`) */
		colorIndex: number;
		/** Extra classes, e.g. a breakpoint that hides it */
		class?: string;
		/** Swallow one `gap-mark-gap` of the row, so a zero-width repeat leaves one gap, not two */
		absorbGap?: boolean;
		testId?: string;
	}

	let { contractId, colorIndex, class: extraClass = '', absorbGap = false, testId = 'contract-tile-repeat' }: Props = $props();

	const tileIndex = $derived(tileIndexForContract(contractId));
</script>

<span
	class="block h-(--size-tile-repeat) min-w-0 flex-1 basis-0 opacity-(--opacity-tile-repeat) forced-color-adjust-none {getClientDotClass(colorIndex)} {absorbGap
		? '-ml-mark-gap bg-clip-content pl-mark-gap'
		: ''} {extraClass}"
	style={tileMaskStyle(tileIndex, 'var(--size-tile-repeat)', 'repeat-x')}
	aria-hidden="true"
	data-testid={testId}
	data-tile={TILE_MOTIFS[tileIndex].id}
></span>
