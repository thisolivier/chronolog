/**
 * Contract pattern tiles (design r1 DS-02 / DS-03 / DS-07, sprint 063-DR).
 *
 * A library of procedural one-colour cutouts: each motif is flat geometry on a transparent
 * 24 × 24 square. The SVG is used as a CSS mask over an element whose background is the client's
 * identity colour, so one source square tints with any colour token and serves both the single
 * mark and the edge-to-edge repeats (DS-03: zero gap, no stretch, clipped at the end).
 *
 * Every motif was checked on the contact sheet at the small mark size (16 px): motifs that blurred
 * into a neighbour there were dropped (fine diagonal stripes, a dotted frame, scallops, paired
 * half-discs). The order of `TILE_MOTIFS` is the allocation order: never
 * reorder or remove an entry without accepting that every contract may change pattern.
 */

export const TILE_VIEWBOX = 24;

export interface TileMotif {
	/** Stable id, for tests, the contact sheet and a later persisted assignment */
	id: string;
	/** SVG child elements drawn in black on the 24 × 24 square */
	shapes: string;
}

// --- geometry helpers (black fill: a mask reads alpha, so any opaque colour works) ---

const rect = (x: number, y: number, width: number, height: number) =>
	`<rect x="${x}" y="${y}" width="${width}" height="${height}"/>`;
const circle = (cx: number, cy: number, radius: number) => `<circle cx="${cx}" cy="${cy}" r="${radius}"/>`;
const polygon = (points: number[][]) => `<polygon points="${points.map((point) => point.join(',')).join(' ')}"/>`;
const path = (data: string) => `<path d="${data}" fill-rule="evenodd"/>`;
/** Rotate shapes about the square's centre */
const rotated = (degrees: number, shapes: string) => `<g transform="rotate(${degrees} 12 12)">${shapes}</g>`;

/** Diagonal "/" bands: `period` along the diagonal, `band` of it filled; tiles seamlessly when period divides 24 */
function diagonalStripes(period: number, band: number): string {
	const shapes: string[] = [];
	for (let start = 0; start < 48; start += period) {
		shapes.push(polygon([[start, 0], [start + band, 0], [start + band - 48, 48], [start - 48, 48]]));
	}
	// Bands run past the square on both sides and are clipped by the viewBox
	return shapes.join('');
}

/** Horizontal bars: `count` bars of `thickness`, evenly spaced (period 24 / count) */
function bars(count: number, thickness: number): string {
	const period = TILE_VIEWBOX / count;
	const offset = (period - thickness) / 2;
	return Array.from({ length: count }, (_, index) => rect(0, index * period + offset, 24, thickness)).join('');
}

/** A grid of `count` × `count` dots of `radius`, centred in their cells */
function dots(count: number, radius: number): string {
	const cell = TILE_VIEWBOX / count;
	const shapes: string[] = [];
	for (let row = 0; row < count; row += 1) {
		for (let column = 0; column < count; column += 1) shapes.push(circle(cell * column + cell / 2, cell * row + cell / 2, radius));
	}
	return shapes.join('');
}

/** A `count` × `count` checkerboard */
function checks(count: number): string {
	const cell = TILE_VIEWBOX / count;
	const shapes: string[] = [];
	for (let row = 0; row < count; row += 1) {
		for (let column = 0; column < count; column += 1) if ((row + column) % 2 === 0) shapes.push(rect(column * cell, row * cell, cell, cell));
	}
	return shapes.join('');
}

/** Zigzag band across the square: `count` teeth, band `thickness` */
function zigzag(count: number, thickness: number, baseline: number): string {
	const width = TILE_VIEWBOX / count;
	const amplitude = width / 2;
	const top: number[][] = [];
	for (let index = 0; index <= count * 2; index += 1) top.push([(index * width) / 2, baseline + (index % 2 === 0 ? amplitude : -amplitude)]);
	const bottom = top.map(([x, y]) => [x, y + thickness]).reverse();
	return polygon([...top, ...bottom]);
}

/** Two stacked chevrons pointing up */
function chevrons(): string {
	const chevron = (top: number) => polygon([[0, top + 8], [12, top], [24, top + 8], [24, top + 13], [12, top + 5], [0, top + 13]]);
	return chevron(0) + chevron(12);
}

/**
 * The library, in allocation order. Ids name the shape (`-v`, `-down`, `-r`: turned versions).
 */
export const TILE_MOTIFS: readonly TileMotif[] = [
	{ id: 'stripes-up', shapes: diagonalStripes(12, 6) },
	{ id: 'dots-2', shapes: dots(2, 4.5) },
	{ id: 'bars-2', shapes: bars(2, 6) },
	{ id: 'checks-2', shapes: checks(2) },
	{ id: 'stripes-down', shapes: rotated(90, diagonalStripes(12, 6)) },
	{ id: 'dots-3', shapes: dots(3, 2.75) },
	{ id: 'bars-2-v', shapes: rotated(90, bars(2, 6)) },
	{ id: 'triangle-half', shapes: polygon([[0, 0], [0, 24], [24, 24]]) },
	{ id: 'disc', shapes: circle(12, 12, 9) },
	{ id: 'ring', shapes: path('M12 2.5a9.5 9.5 0 1 0 0 19a9.5 9.5 0 1 0 0-19ZM12 7.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9Z') },
	{ id: 'plus', shapes: rect(9, 2, 6, 20) + rect(2, 9, 20, 6) },
	{ id: 'saltire', shapes: rotated(45, rect(9.5, -1, 5, 26) + rect(-1, 9.5, 26, 5)) },
	{ id: 'diamond', shapes: polygon([[12, 1], [23, 12], [12, 23], [1, 12]]) },
	{ id: 'chevrons-up', shapes: chevrons() },
	{ id: 'zigzag', shapes: zigzag(2, 5, 9.5) },
	{ id: 'half-disc', shapes: path('M2 20a10 10 0 0 1 20 0Z') },
	{ id: 'quarter-arc', shapes: path('M0 0h20a20 20 0 0 1-20 20Z') },
	{ id: 'quarters-opposite', shapes: path('M0 0h12a12 12 0 0 1-12 12Z') + path('M24 24h-12a12 12 0 0 1 12-12Z') },
	{ id: 'checks-4', shapes: checks(4) },
	{ id: 'bars-3', shapes: bars(3, 4) },
	{ id: 'triangles-up', shapes: polygon([[0, 22], [6, 10], [12, 22]]) + polygon([[12, 22], [18, 10], [24, 22]]) },
	{ id: 'frame', shapes: path('M2 2h20v20h-20ZM7 7v10h10v-10Z') },
	{ id: 'bowtie', shapes: polygon([[2, 2], [12, 12], [2, 22]]) + polygon([[22, 2], [12, 12], [22, 22]]) },
	{ id: 'steps', shapes: path('M0 24v-8h8v-8h8v-8h8v24Z') },
	{ id: 'target', shapes: path('M12 1.5a10.5 10.5 0 1 0 0 21a10.5 10.5 0 1 0 0-21ZM12 5.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13Z') + circle(12, 12, 3) },
	{ id: 'pinwheel', shapes: polygon([[0, 0], [12, 0], [12, 12]]) + polygon([[24, 0], [24, 12], [12, 12]]) + polygon([[24, 24], [12, 24], [12, 12]]) + polygon([[0, 24], [0, 12], [12, 12]]) },
	{ id: 'quincunx', shapes: circle(5, 5, 3.5) + circle(19, 5, 3.5) + circle(12, 12, 3.5) + circle(5, 19, 3.5) + circle(19, 19, 3.5) },
	{ id: 'corner-l', shapes: path('M2 2h7v13h13v7h-20Z') },
	{ id: 'hash', shapes: rect(6, 1, 4, 22) + rect(14, 1, 4, 22) + rect(1, 6, 22, 4) + rect(1, 14, 22, 4) },
	{ id: 'arrows-right', shapes: polygon([[2, 2], [12, 12], [2, 22], [2, 15], [5, 12], [2, 9]]) + polygon([[12, 2], [22, 12], [12, 22], [12, 15], [15, 12], [12, 9]]) },
	{ id: 'triangle-up', shapes: polygon([[12, 2], [23, 21], [1, 21]]) },
	{ id: 'triangle-down', shapes: rotated(180, polygon([[12, 2], [23, 21], [1, 21]])) },
	{ id: 'half-disc-r', shapes: rotated(90, path('M2 20a10 10 0 0 1 20 0Z')) },
	{ id: 'bricks', shapes: rect(0, 1, 10, 4) + rect(12, 1, 10, 4) + rect(6, 9, 10, 4) + rect(18, 9, 6, 4) + rect(0, 9, 4, 4) + rect(0, 17, 10, 4) + rect(12, 17, 10, 4) }
];

/** The motif count; allocation is modulo this */
export const TILE_COUNT = TILE_MOTIFS.length;

/** The standalone SVG of one motif (black on transparent), for a CSS mask */
export function tileSvg(motif: TileMotif): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE_VIEWBOX} ${TILE_VIEWBOX}">${motif.shapes}</svg>`;
}

const maskUrlCache = new Map<number, string>();

/** `url('data:image/svg+xml,…')` (single quotes: safe inside a double-quoted style attribute) for the motif at `index` (wrapped into the library), cached */
export function tileMaskUrl(index: number): string {
	const wrappedIndex = ((index % TILE_COUNT) + TILE_COUNT) % TILE_COUNT;
	let url = maskUrlCache.get(wrappedIndex);
	if (!url) {
		url = `url('data:image/svg+xml,${encodeURIComponent(tileSvg(TILE_MOTIFS[wrappedIndex]))}')`;
		maskUrlCache.set(wrappedIndex, url);
	}
	return url;
}

/**
 * Inline style that cuts the motif out of an element's background colour: one tile of
 * `tileSize` (a CSS length) at the top left, repeated edge to edge along x (or both axes) and
 * clipped at the element's edge, never stretched. WebKit (Safari / iOS before 15.4 and the Tauri
 * webview) needs the `-webkit-` mask properties, so both are written.
 */
export function tileMaskStyle(index: number, tileSize: string, repeat: 'no-repeat' | 'repeat-x' | 'repeat' = 'repeat'): string {
	const url = tileMaskUrl(index);
	const declarations = [
		['mask-image', url],
		['mask-size', `${tileSize} ${tileSize}`],
		['mask-repeat', repeat],
		['mask-position', '0 0']
	];
	return declarations.flatMap(([property, value]) => [`-webkit-${property}: ${value}`, `${property}: ${value}`]).join('; ');
}

/**
 * The contract's motif index: FNV-1a (32-bit) of its id, modulo the library size. Deterministic,
 * so every surface draws the same tile for a contract with no stored assignment (DS-02 / DS-07).
 * Two contracts may share a motif; a persisted, collision-avoiding assignment is a backlog item.
 */
export function tileIndexForContract(contractId: string): number {
	let hash = 0x811c9dc5;
	for (let position = 0; position < contractId.length; position += 1) {
		hash ^= contractId.charCodeAt(position);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0) % TILE_COUNT;
}
