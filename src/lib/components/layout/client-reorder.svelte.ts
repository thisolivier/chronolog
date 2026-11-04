/**
 * Reordering clients in the sidebar (sprint 039-CL): native HTML5 drag and drop on a client's
 * heading (or its single row), and Alt+ArrowUp / Alt+ArrowDown on it for the keyboard, announced in
 * a live region. The new order is applied at once (`apply`) and then saved (`persist`); a failed
 * save calls `revert`.
 */

/** `order` with `clientId` moved to `targetIndex` (clamped); the same array contents otherwise */
export function moveInOrder(order: string[], clientId: string, targetIndex: number): string[] {
	if (!order.includes(clientId)) return order;
	const others = order.filter((id) => id !== clientId);
	const clampedIndex = Math.min(Math.max(targetIndex, 0), others.length);
	others.splice(clampedIndex, 0, clientId);
	return others;
}

/** Index to drop `draggedId` at, dropped before or after `targetId` */
export function dropIndex(order: string[], draggedId: string, targetId: string, placement: 'before' | 'after'): number {
	const others = order.filter((id) => id !== draggedId);
	const targetIndex = others.indexOf(targetId);
	if (targetIndex === -1) return order.indexOf(draggedId);
	return placement === 'before' ? targetIndex : targetIndex + 1;
}

export interface ClientReorderOptions {
	/** Active clients, top to bottom, as the sidebar shows them */
	getOrder: () => string[];
	nameOf: (clientId: string) => string;
	apply: (orderedClientIds: string[]) => void;
	persist: (orderedClientIds: string[]) => Promise<void>;
	revert: () => void;
}

const DRAG_DATA_TYPE = 'text/plain';

export class ClientReorderController {
	draggedClientId = $state<string | null>(null);
	dropTarget = $state<{ clientId: string; placement: 'before' | 'after' } | null>(null);
	/** Text for the sidebar's polite live region */
	announcement = $state('');

	private readonly options: ClientReorderOptions;

	constructor(options: ClientReorderOptions) {
		this.options = options;
	}

	/** Move to `targetIndex` (0 = top); false when nothing changed */
	moveTo(clientId: string, targetIndex: number): boolean {
		const order = this.options.getOrder();
		const nextOrder = moveInOrder(order, clientId, targetIndex);
		if (nextOrder.join() === order.join()) return false;
		this.options.apply(nextOrder);
		const position = nextOrder.indexOf(clientId) + 1;
		this.announcement = `${this.options.nameOf(clientId)} moved to position ${position} of ${nextOrder.length}`;
		this.options.persist(nextOrder).catch(() => {
			this.options.revert();
			this.announcement = `Could not save the new order; ${this.options.nameOf(clientId)} is back in its place`;
		});
		return true;
	}

	/** Alt+ArrowUp / Alt+ArrowDown on a client's heading; true when the key was handled */
	handleKeydown(clientId: string, event: KeyboardEvent): boolean {
		if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return false;
		event.preventDefault();
		const currentIndex = this.options.getOrder().indexOf(clientId);
		this.moveTo(clientId, currentIndex + (event.key === 'ArrowUp' ? -1 : 1));
		return true;
	}

	dragStart(clientId: string, event: DragEvent, dragImage?: HTMLElement | null) {
		this.draggedClientId = clientId;
		if (!event.dataTransfer) return;
		event.dataTransfer.effectAllowed = 'move';
		// Firefox and WebKit only start a drag that carries data
		event.dataTransfer.setData(DRAG_DATA_TYPE, clientId);
		if (dragImage) event.dataTransfer.setDragImage(dragImage, 12, 12);
	}

	dragOver(clientId: string, event: DragEvent, element: HTMLElement) {
		if (!this.draggedClientId) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		const bounds = element.getBoundingClientRect();
		const placement = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
		if (this.dropTarget?.clientId !== clientId || this.dropTarget.placement !== placement) {
			this.dropTarget = { clientId, placement };
		}
	}

	drop(clientId: string, event: DragEvent) {
		const draggedClientId = this.draggedClientId;
		const target = this.dropTarget;
		this.dragEnd();
		if (!draggedClientId || !target || target.clientId !== clientId) return;
		event.preventDefault();
		const order = this.options.getOrder();
		this.moveTo(draggedClientId, dropIndex(order, draggedClientId, clientId, target.placement));
	}

	dragEnd() {
		this.draggedClientId = null;
		this.dropTarget = null;
	}
}
