/**
 * Client color palette for visual differentiation in the timesheet UI.
 *
 * Each client is assigned a color slot (0-7). The palette wraps around
 * for indices beyond 7 using modulo arithmetic.
 *
 * `borderClass` is a LEFT-border-only utility (`border-l-*`). Cards and the new-entry row also
 * carry `border border-stone-200` for the other three sides; an all-sides `border-rose-400` class
 * would lose to that stone class in Tailwind's output order, so the client colour never showed.
 * The class strings must stay as literals in this file so Tailwind v4's source scanner emits them.
 */

export interface ClientColor {
	name: string;
	borderClass: string;
	dotClass: string;
	bgClass: string;
}

export const CLIENT_COLORS: readonly ClientColor[] = [
	{ name: 'Rose', borderClass: 'border-l-rose-400', dotClass: 'bg-rose-400', bgClass: 'bg-rose-50' },
	{ name: 'Sky', borderClass: 'border-l-sky-400', dotClass: 'bg-sky-400', bgClass: 'bg-sky-50' },
	{
		name: 'Violet',
		borderClass: 'border-l-violet-400',
		dotClass: 'bg-violet-400',
		bgClass: 'bg-violet-50'
	},
	{
		name: 'Amber',
		borderClass: 'border-l-amber-500',
		dotClass: 'bg-amber-500',
		bgClass: 'bg-amber-50'
	},
	{
		name: 'Teal',
		borderClass: 'border-l-teal-400',
		dotClass: 'bg-teal-400',
		bgClass: 'bg-teal-50'
	},
	{
		name: 'Fuchsia',
		borderClass: 'border-l-fuchsia-400',
		dotClass: 'bg-fuchsia-400',
		bgClass: 'bg-fuchsia-50'
	},
	{
		name: 'Lime',
		borderClass: 'border-l-lime-500',
		dotClass: 'bg-lime-500',
		bgClass: 'bg-lime-50'
	},
	{
		name: 'Orange',
		borderClass: 'border-l-orange-400',
		dotClass: 'bg-orange-400',
		bgClass: 'bg-orange-50'
	}
] as const;

/** Returns the left-border class (e.g. `border-l-rose-400`) for a client color index, wrapping for >7. */
export function getClientBorderClass(colorIndex: number): string {
	const wrappedIndex = colorIndex % CLIENT_COLORS.length;
	return CLIENT_COLORS[wrappedIndex].borderClass;
}

/** Returns the dot class (e.g. `bg-rose-400`) for a client color index, wrapping for >7. */
export function getClientDotClass(colorIndex: number): string {
	const wrappedIndex = colorIndex % CLIENT_COLORS.length;
	return CLIENT_COLORS[wrappedIndex].dotClass;
}

/** Returns the subtle background class (e.g. `bg-rose-50`) for a client color index, wrapping for >7. */
export function getClientBgClass(colorIndex: number): string {
	const wrappedIndex = colorIndex % CLIENT_COLORS.length;
	return CLIENT_COLORS[wrappedIndex].bgClass;
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
