import type { WikiLinkSuggestionItem } from './wiki-link.js';

/**
 * Configuration for the SuggestionDropdown.
 */
export interface SuggestionDropdownProps {
	items: WikiLinkSuggestionItem[];
	command: (item: WikiLinkSuggestionItem) => void;
	clientRect: (() => DOMRect | null) | null;
}

/**
 * Vanilla JS dropdown for the WikiLink suggestion popup.
 *
 * Renders a positioned dropdown list of matching notes below the cursor.
 * Supports keyboard navigation (arrow keys, Enter, Escape) and mouse
 * selection.
 */
export class SuggestionDropdown {
	private containerElement: HTMLDivElement;
	private items: WikiLinkSuggestionItem[] = [];
	private command: (item: WikiLinkSuggestionItem) => void;
	private clientRect: (() => DOMRect | null) | null;
	private selectedIndex = 0;

	constructor(props: SuggestionDropdownProps) {
		this.items = props.items;
		this.command = props.command;
		this.clientRect = props.clientRect;

		this.containerElement = document.createElement('div');
		this.containerElement.className =
			'absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto';

		document.body.appendChild(this.containerElement);
		this.renderItems();
		this.positionDropdown();
	}

	/**
	 * Update the dropdown with new items/command/position.
	 */
	update(props: SuggestionDropdownProps): void {
		this.items = props.items;
		this.command = props.command;
		this.clientRect = props.clientRect;
		this.selectedIndex = 0;

		this.renderItems();
		this.positionDropdown();
	}

	/**
	 * Handle keyboard events for navigation.
	 * Returns true if the event was handled by the dropdown.
	 */
	onKeyDown(event: KeyboardEvent): boolean {
		if (event.key === 'ArrowDown') {
			this.selectedIndex = Math.min(this.selectedIndex + 1, this.items.length - 1);
			this.updateSelection();
			return true;
		}

		if (event.key === 'ArrowUp') {
			this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
			this.updateSelection();
			return true;
		}

		if (event.key === 'Enter') {
			const selectedItem = this.items[this.selectedIndex];
			if (selectedItem) {
				this.command(selectedItem);
			}
			return true;
		}

		if (event.key === 'Escape') {
			this.destroy();
			return true;
		}

		return false;
	}

	/**
	 * Remove the dropdown from the DOM and clean up.
	 */
	destroy(): void {
		this.containerElement.remove();
	}

	/**
	 * Render the list items inside the dropdown container.
	 */
	private renderItems(): void {
		this.containerElement.innerHTML = '';

		if (this.items.length === 0) {
			const emptyMessage = document.createElement('div');
			emptyMessage.className = 'px-3 py-2 text-sm text-gray-400 italic';
			emptyMessage.textContent = 'No matching notes';
			this.containerElement.appendChild(emptyMessage);
			return;
		}

		this.items.forEach((item, index) => {
			const itemElement = document.createElement('button');
			itemElement.type = 'button';
			itemElement.className = this.getItemClassName(index);

			// Note ID line
			const noteIdSpan = document.createElement('span');
			noteIdSpan.className = 'block text-xs font-mono text-gray-400';
			noteIdSpan.textContent = item.noteId;

			// Title line
			const titleSpan = document.createElement('span');
			titleSpan.className = 'block text-sm text-gray-800';
			titleSpan.textContent = item.title || item.noteId;

			itemElement.appendChild(noteIdSpan);
			itemElement.appendChild(titleSpan);

			itemElement.addEventListener('mouseenter', () => {
				this.selectedIndex = index;
				this.updateSelection();
			});

			itemElement.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.command(item);
			});

			this.containerElement.appendChild(itemElement);
		});
	}

	/**
	 * Update which item has the selected visual state.
	 */
	private updateSelection(): void {
		const itemElements = this.containerElement.querySelectorAll('button');
		itemElements.forEach((element, index) => {
			element.className = this.getItemClassName(index);
		});

		// Scroll selected item into view
		const selectedElement = itemElements[this.selectedIndex];
		if (selectedElement) {
			selectedElement.scrollIntoView({ block: 'nearest' });
		}
	}

	/**
	 * Returns the appropriate Tailwind classes for a list item.
	 */
	private getItemClassName(index: number): string {
		const baseClasses = 'w-full text-left px-3 py-2 cursor-pointer hover:bg-blue-50 block';
		const selectedClass = index === this.selectedIndex ? ' bg-blue-50' : '';
		return baseClasses + selectedClass;
	}

	/**
	 * Position the dropdown element relative to the cursor.
	 */
	private positionDropdown(): void {
		if (!this.clientRect) return;

		const rect = this.clientRect();
		if (!rect) return;

		const dropdownHeight = 240; // max-h-60 = 15rem = 240px
		const viewportHeight = window.innerHeight;
		const spaceBelow = viewportHeight - rect.bottom;

		// Position below the cursor by default; above if not enough space
		if (spaceBelow >= dropdownHeight || spaceBelow >= rect.top) {
			// Show below
			this.containerElement.style.top = `${rect.bottom + window.scrollY + 4}px`;
		} else {
			// Show above
			this.containerElement.style.top = `${rect.top + window.scrollY - dropdownHeight - 4}px`;
		}

		this.containerElement.style.left = `${rect.left + window.scrollX}px`;
		this.containerElement.style.minWidth = '240px';
		this.containerElement.style.maxWidth = '400px';
	}
}
