import { describe, expect, it } from 'vitest';
import { headerReflectionFor, isTimerWidgetOnScreen, type ShellPresentation } from './timer-visibility';

const desktop: ShellPresentation = {
	layoutMode: 'desktop',
	sidebarCollapsed: false,
	sidebarIsOverlay: false,
	overlaySidebarOpen: false,
	mountedWidgetCount: 1
};

describe('header timer reflection (SH-02 state matrix)', () => {
	it('desktop sidebar expanded or compact widget: hidden (the widget is on screen)', () => {
		expect(headerReflectionFor('running', desktop)).toBe('none');
		expect(headerReflectionFor('stopped', desktop)).toBe('none');
	});

	it('sidebar hidden and running: the running reflection, though the widget stays mounted', () => {
		const hidden = { ...desktop, sidebarCollapsed: true };
		expect(isTimerWidgetOnScreen(hidden)).toBe(false);
		expect(headerReflectionFor('running', hidden)).toBe('running');
	});

	it('sidebar hidden and stopped unfinished: Finish entry', () => {
		expect(headerReflectionFor('stopped', { ...desktop, sidebarCollapsed: true })).toBe('finish');
	});

	it('tablet overlay: closed shows the reflection, open hides it; the desktop preference does not apply', () => {
		const tablet = { ...desktop, layoutMode: 'tablet' as const, sidebarIsOverlay: true, sidebarCollapsed: true };
		expect(headerReflectionFor('running', tablet)).toBe('running');
		expect(headerReflectionFor('stopped', { ...tablet, sidebarCollapsed: false })).toBe('finish');
		expect(headerReflectionFor('running', { ...tablet, overlaySidebarOpen: true })).toBe('none');
	});

	it('tablet time mode (inline sidebar) follows the hide preference like desktop', () => {
		const tablet = { ...desktop, layoutMode: 'tablet' as const };
		expect(headerReflectionFor('running', tablet)).toBe('none');
		expect(headerReflectionFor('running', { ...tablet, sidebarCollapsed: true })).toBe('running');
	});

	it('phone: capture screen (a mounted widget) hides it; a note screen (no widget) shows it', () => {
		const phoneCapture = { ...desktop, layoutMode: 'mobile' as const, sidebarCollapsed: true };
		expect(headerReflectionFor('running', phoneCapture)).toBe('none');
		const phoneNote = { ...phoneCapture, mountedWidgetCount: 0 };
		expect(headerReflectionFor('running', phoneNote)).toBe('running');
		expect(headerReflectionFor('stopped', phoneNote)).toBe('finish');
	});

	it('no running or unfinished capture: nothing, whatever the layout', () => {
		expect(headerReflectionFor('idle', { ...desktop, sidebarCollapsed: true })).toBe('none');
		expect(headerReflectionFor('idle', { ...desktop, layoutMode: 'mobile', mountedWidgetCount: 0 })).toBe('none');
	});

	it('a legacy paused status reads as running', () => {
		expect(headerReflectionFor('paused', { ...desktop, sidebarCollapsed: true })).toBe('running');
	});
});
