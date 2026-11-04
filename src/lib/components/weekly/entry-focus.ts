/**
 * Where keyboard focus goes after the timesheet saves an entry (journey finding A-11): the saved
 * entry's card, or, when that card is not rendered (another week, an offline temporary id),
 * the day's "add entry" control. Never left on <body>.
 */
type FocusableRoot = Pick<ParentNode, 'querySelector'>;

/** Attribute on each time entry card */
export const ENTRY_ID_ATTRIBUTE = 'data-entry-id';
/** Attribute on each day's "+" (add entry) button */
export const ADD_ENTRY_ATTRIBUTE = 'data-add-entry';

function attributeSelector(attribute: string, value: string): string {
	return `[${attribute}="${value.replace(/["\\]/g, '\\$&')}"]`;
}

export function focusSavedEntry(
	root: FocusableRoot,
	entryId: string | null | undefined,
	date: string
): 'card' | 'add-entry' | null {
	const card = entryId ? root.querySelector<HTMLElement>(attributeSelector(ENTRY_ID_ATTRIBUTE, entryId)) : null;
	if (card) {
		card.focus();
		return 'card';
	}
	const addEntryControl = root.querySelector<HTMLElement>(attributeSelector(ADD_ENTRY_ATTRIBUTE, date));
	if (addEntryControl) {
		addEntryControl.focus();
		return 'add-entry';
	}
	return null;
}
