/**
 * Workspace URLs <-> navigation state (sprint 027-CL). Pure functions, no Svelte.
 *
 *   /                                 home: phone = sidebar (level 0); wider = this week's timesheet
 *   /time/2026-W45                    timesheet for ISO week 45 of 2026
 *   /notes/<contractId>               a contract's note list
 *   /notes/<contractId>/<noteId>      a note open under its contract
 *   /notes/<contractId>/new           an unsaved new-note draft for that contract
 */
import { getIsoWeekNumber, getIsoYear, getMondayOfIsoWeek, getMondayOfWeek } from '$lib/utils/iso-week';

export type WorkspaceRoute =
	| { kind: 'home' }
	| { kind: 'time'; week: string }
	| { kind: 'notes'; contractId: string; noteId: string | null; draft: boolean };

/** Path segment used for a new-note draft (note IDs look like `ACME.20261103.005`, never `new`) */
export const DRAFT_SEGMENT = 'new';

const ISO_WEEK_PATTERN = /^(\d{4})-W(\d{2})$/;

/** `2026-11-02` (a Monday) -> `2026-W45` */
export function weekParamFromMonday(monday: string): string {
	return `${getIsoYear(monday)}-W${String(getIsoWeekNumber(monday)).padStart(2, '0')}`;
}

/** `2026-W45` -> `2026-11-02`; null for anything that is not a real ISO week */
export function mondayFromWeekParam(param: string): string | null {
	const match = ISO_WEEK_PATTERN.exec(param);
	if (!match) return null;
	const year = Number(match[1]);
	const weekNumber = Number(match[2]);
	if (weekNumber < 1 || weekNumber > 53) return null;
	const monday = getMondayOfIsoWeek(year, weekNumber);
	// Week 53 only exists in some years: reject it when it rolls into the next year's week 1
	return getIsoYear(monday) === year && getIsoWeekNumber(monday) === weekNumber ? monday : null;
}

export function todayDateString(now: Date = new Date()): string {
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function currentMonday(now: Date = new Date()): string {
	return getMondayOfWeek(todayDateString(now));
}

/** Parse a pathname; null when it is not a workspace URL (settings, admin, login…) */
export function parseWorkspacePath(pathname: string, fallbackWeek: string): WorkspaceRoute | null {
	const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
	if (segments.length === 0) return { kind: 'home' };
	if (segments[0] === 'time' && segments.length <= 2) {
		if (segments.length === 1) return { kind: 'time', week: fallbackWeek };
		const monday = mondayFromWeekParam(segments[1]);
		return monday ? { kind: 'time', week: monday } : null;
	}
	if (segments[0] === 'notes' && (segments.length === 2 || segments.length === 3)) {
		const contractId = segments[1];
		const noteSegment = segments[2] ?? null;
		const draft = noteSegment === DRAFT_SEGMENT;
		return { kind: 'notes', contractId, noteId: draft ? null : noteSegment, draft };
	}
	return null;
}

export function buildWorkspacePath(route: WorkspaceRoute): string {
	switch (route.kind) {
		case 'home':
			return '/';
		case 'time':
			return `/time/${weekParamFromMonday(route.week)}`;
		case 'notes': {
			const base = `/notes/${encodeURIComponent(route.contractId)}`;
			if (route.draft) return `${base}/${DRAFT_SEGMENT}`;
			return route.noteId ? `${base}/${encodeURIComponent(route.noteId)}` : base;
		}
	}
}

/** Phone drill-down depth: home = sidebar (0); timesheet or note list = 1; a note or draft = 2 */
export function mobileLevelFor(route: WorkspaceRoute): 0 | 1 | 2 {
	if (route.kind === 'home') return 0;
	if (route.kind === 'notes' && (route.noteId || route.draft)) return 2;
	return 1;
}

/** One level up: note -> its contract's list; list or timesheet -> home */
export function parentRoute(route: WorkspaceRoute): WorkspaceRoute {
	if (route.kind === 'notes' && (route.noteId || route.draft)) {
		return { kind: 'notes', contractId: route.contractId, noteId: null, draft: false };
	}
	return { kind: 'home' };
}

export function sameRoute(first: WorkspaceRoute, second: WorkspaceRoute): boolean {
	return buildWorkspacePath(first) === buildWorkspacePath(second);
}
