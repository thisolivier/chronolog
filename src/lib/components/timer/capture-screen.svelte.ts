/**
 * The phone's focused capture screen (design r1 TC-08, sprint 055-DR). The header pill opens it
 * over whatever screen the user was on; Back closes it and that screen is still there, unchanged
 * (the originating work screen). It never starts, stops, saves or discards anything by itself:
 * a stopped capture's fields stay in the capture store (sprint 053-DR) and its frozen end on the
 * server row or the pending timer.
 */
class CaptureScreenState {
	isOpen = $state(false);

	open(): void {
		this.isOpen = true;
	}

	close(): void {
		this.isOpen = false;
	}
}

export const captureScreen = new CaptureScreenState();
