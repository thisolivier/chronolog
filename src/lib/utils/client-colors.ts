/**
 * Client colour palette: eight earth-tone identity colours (design r1, sprint 052-DR).
 *
 * Each client is assigned a colour slot (0-7) stored as `clients.color_index`. The palette wraps
 * around for indices beyond 7 using modulo arithmetic. The values live in src/lib/styles/tokens.css
 * as `--color-id-<name>` (strong mark), `-wash` (pale background) and `-ink` (text on the wash).
 * Slots keep their old hue family where one exists (Rose to Rust, Sky to Juniper, Teal to Lake, ...), so a
 * client's colour shifts tone, not meaning, and no migration is needed.
 *
 * `borderClass` is a LEFT-border-only utility (`border-l-*`). Cards and the new-entry row also
 * carry an all-sides neutral border; an all-sides identity border class would lose to that one in
 * Tailwind's output order, so the client colour never showed.
 * The class strings must stay as literals in this file so Tailwind v4's source scanner emits them.
 */

export interface ClientColor {
	name: string;
	/** Left border in the strong identity colour */
	borderClass: string;
	/** Background in the strong identity colour: dots, week-strip segments, contract marks */
	dotClass: string;
	/** Text colour for initials on the strong colour (AA, 4.5:1 or better) */
	markTextClass: string;
	/** Pale wash background */
	bgClass: string;
	/** Text colour on the wash (AA) */
	washTextClass: string;
}

export const CLIENT_COLORS: readonly ClientColor[] = [
	{
		name: 'Rust',
		borderClass: 'border-l-id-rust',
		dotClass: 'bg-id-rust',
		markTextClass: 'text-on-accent',
		bgClass: 'bg-id-rust-wash',
		washTextClass: 'text-id-rust-ink'
	},
	{
		name: 'Juniper',
		borderClass: 'border-l-id-juniper',
		dotClass: 'bg-id-juniper',
		markTextClass: 'text-on-accent',
		bgClass: 'bg-id-juniper-wash',
		washTextClass: 'text-id-juniper-ink'
	},
	{
		name: 'Heather',
		borderClass: 'border-l-id-heather',
		dotClass: 'bg-id-heather',
		markTextClass: 'text-on-accent',
		bgClass: 'bg-id-heather-wash',
		washTextClass: 'text-id-heather-ink'
	},
	{
		name: 'Ochre',
		borderClass: 'border-l-id-ochre',
		dotClass: 'bg-id-ochre',
		markTextClass: 'text-ink',
		bgClass: 'bg-id-ochre-wash',
		washTextClass: 'text-id-ochre-ink'
	},
	{
		name: 'Lake',
		borderClass: 'border-l-id-lake',
		dotClass: 'bg-id-lake',
		markTextClass: 'text-on-accent',
		bgClass: 'bg-id-lake-wash',
		washTextClass: 'text-id-lake-ink'
	},
	{
		name: 'Bark',
		borderClass: 'border-l-id-bark',
		dotClass: 'bg-id-bark',
		markTextClass: 'text-on-accent',
		bgClass: 'bg-id-bark-wash',
		washTextClass: 'text-id-bark-ink'
	},
	{
		name: 'Moss',
		borderClass: 'border-l-id-moss',
		dotClass: 'bg-id-moss',
		markTextClass: 'text-ink',
		bgClass: 'bg-id-moss-wash',
		washTextClass: 'text-id-moss-ink'
	},
	{
		name: 'Clay',
		borderClass: 'border-l-id-clay',
		dotClass: 'bg-id-clay',
		markTextClass: 'text-on-accent',
		bgClass: 'bg-id-clay-wash',
		washTextClass: 'text-id-clay-ink'
	}
] as const;

/** Returns the left-border class (e.g. `border-l-id-rust`) for a client color index, wrapping for >7. */
export function getClientBorderClass(colorIndex: number): string {
	const wrappedIndex = colorIndex % CLIENT_COLORS.length;
	return CLIENT_COLORS[wrappedIndex].borderClass;
}

/** Returns the dot class (e.g. `bg-id-rust`) for a client color index, wrapping for >7. */
export function getClientDotClass(colorIndex: number): string {
	const wrappedIndex = colorIndex % CLIENT_COLORS.length;
	return CLIENT_COLORS[wrappedIndex].dotClass;
}

/** Returns the subtle background class (e.g. `bg-id-rust-wash`) for a client color index, wrapping for >7. */
export function getClientBgClass(colorIndex: number): string {
	const wrappedIndex = colorIndex % CLIENT_COLORS.length;
	return CLIENT_COLORS[wrappedIndex].bgClass;
}

/** Returns the text class for initials on the strong colour (e.g. `text-on-accent`), wrapping for >7. */
export function getClientMarkTextClass(colorIndex: number): string {
	const wrappedIndex = colorIndex % CLIENT_COLORS.length;
	return CLIENT_COLORS[wrappedIndex].markTextClass;
}

/**
 * True when `value` is an integer colour index within the palette (0..7). Used by the admin
 * form action and `PATCH /api/clients/:id` to validate user-supplied indices before persisting.
 */
export function isValidClientColorIndex(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < CLIENT_COLORS.length;
}

/**
 * The colour a new client gets by default: the first palette index none of the user's ACTIVE
 * clients uses (archived ones free their colour, 044-CL); with all eight taken, the least used
 * one (lowest index on a tie). Shared by the admin "New client" form, `POST /api/clients` and the
 * sidebar's inline new client (sprint 031-CL). Existing clients keep their colours.
 */
export function suggestClientColorIndex(activeColorIndexes: readonly number[]): number {
	const usageCounts = CLIENT_COLORS.map(() => 0);
	for (const colorIndex of activeColorIndexes) usageCounts[colorIndex % CLIENT_COLORS.length] += 1;
	const lowestCount = Math.min(...usageCounts);
	return usageCounts.indexOf(lowestCount);
}

export interface SharedClientColor {
	colorIndex: number;
	colorName: string;
	clientNames: string[];
}

/**
 * Palette colours that two or more active clients share, for the hint in Settings → Clients
 * (044-CL). Archived clients are ignored. Ordered by palette index; names keep the given order.
 */
export function findSharedClientColors(
	clientList: readonly { name: string; colorIndex: number; archivedAt: Date | string | null }[]
): SharedClientColor[] {
	const namesByColor = new Map<number, string[]>();
	for (const client of clientList) {
		if (client.archivedAt !== null) continue;
		const colorIndex = client.colorIndex % CLIENT_COLORS.length;
		namesByColor.set(colorIndex, [...(namesByColor.get(colorIndex) ?? []), client.name]);
	}
	return [...namesByColor.entries()]
		.filter(([, clientNames]) => clientNames.length > 1)
		.sort(([left], [right]) => left - right)
		.map(([colorIndex, clientNames]) => ({ colorIndex, colorName: CLIENT_COLORS[colorIndex].name, clientNames }));
}
