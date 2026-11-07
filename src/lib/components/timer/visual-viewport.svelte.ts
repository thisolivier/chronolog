/**
 * The visible part of the page above the software keyboard (sprint 055-DR, TC-08 / TC-09).
 *
 * iOS Safari does not shrink the layout viewport (nor `100dvh`) when the keyboard opens; only
 * `window.visualViewport` reports the visible height and how far the page was scrolled to keep
 * the focused field in view. A full-screen surface sized and placed from it keeps its bottom
 * actions just above the keyboard. Without visualViewport the styles fall back to `100dvh`.
 */
export class VisualViewportBox {
	/** Visible height in CSS px; 0 until measured */
	height = $state(0);
	/** Top of the visible area within the layout viewport (iOS scrolls the page under the keyboard) */
	offsetTop = $state(0);

	/** Start following the visual viewport; returns the cleanup (call from an $effect) */
	track(): () => void {
		const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
		if (!viewport) return () => {};
		const measure = () => {
			this.height = Math.round(viewport.height);
			this.offsetTop = Math.round(viewport.offsetTop);
		};
		measure();
		viewport.addEventListener('resize', measure);
		viewport.addEventListener('scroll', measure);
		return () => {
			viewport.removeEventListener('resize', measure);
			viewport.removeEventListener('scroll', measure);
		};
	}

	/** Inline style for a fixed surface that fills exactly the visible area */
	get style(): string {
		return this.height > 0 ? `top: ${this.offsetTop}px; height: ${this.height}px;` : 'top: 0; height: 100dvh;';
	}
}

/** Keep a newly focused field in view inside its scrolling container (after the keyboard settles) */
export function revealFocusedField(event: FocusEvent): void {
	const target = event.target;
	if (!(target instanceof HTMLElement) || !target.matches('input, textarea, select')) return;
	setTimeout(() => target.scrollIntoView({ block: 'nearest' }), 250);
}
