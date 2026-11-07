/**
 * Workspace URLs <-> navigation state (sprint 027-CL). Pure functions, no Svelte.
 *
 *   /                                 home: phone = sidebar (level 0); wider = this week's timesheet
 *   /time/2026-W45                    timesheet for Week 45 of 2026 (Week 1 contains 1 January, calendar-week.ts)
 *   /notes/<contractId>               a contract's note list
 *   /notes/<contractId>/<noteId>      a note open under its contract
 *   /notes/<contractId>/new           an unsaved new-note draft for that contract
 *   /notes/client/<clientId>                        one client's notes, all contracts (039-CL)
 *   /notes/client/<clientId>/<contractId>/<noteId>  a note open with the client view as the list
 *   /notes/client/<clientId>/<contractId>/new       a draft for that contract, client view as the list
 *   /notes/all                        every note of every contract, newest first, no pin float (051-UI)
 *   /notes/all/<contractId>/<noteId>  a note open with all notes as the list (`/new`: a draft)
 *   /notes/trash                      not a workspace URL: the trash page (043-CL)
 */
import { getMondayOfWeek } from '$lib/utils/iso-week';
import { calendarWeekKey, legacyIsoWeekRedirect, parseCalendarWeekKey } from '$lib/utils/calendar-week';

export type WorkspaceRoute =
	| { kind: 'home' }
	| { kind: 'time'; week: string }
	| { kind: 'notes'; contractId: string; noteId: string | null; draft: boolean }
	/** The client view (sprint 039-CL): `contractId` is the open note's or draft's, null on the list */
	| { kind: 'client'; clientId: string; contractId: string | null; noteId: string | null; draft: boolean }
	/** All notes (sprint 051-UI): `contractId` is the open note's or draft's, null on the list */
	| { kind: 'all'; contractId: string | null; noteId: string | null; draft: boolean };

/** Path segment of the client view, `/notes/client/<id>` (contract IDs are UUIDs, never `client`) */
export const CLIENT_SEGMENT = 'client';

/** Path segment of the all-notes view, `/notes/all` (sprint 051-UI; never a contract UUID) */
export const ALL_NOTES_SEGMENT = 'all';
export const ALL_NOTES_PATH = `/notes/${ALL_NOTES_SEGMENT}`;

/** Path of the trash page (sprint 043-CL); `trash` is never a contract UUID */
export const TRASH_SEGMENT = 'trash';
export const TRASH_PATH = `/notes/${TRASH_SEGMENT}`;

/** Path segment used for a new-note draft (note IDs look like `ACME.20261103.005`, never `new`) */
export const DRAFT_SEGMENT = 'new';

const WEEK_PARAM_PATTERN = /^\d{4}-W\d{2}$/;

/** `2026-11-02` (a Monday) -> `2026-W45` */
export function weekParamFromMonday(monday: string): string {
	return calendarWeekKey(monday);
}

/** `2026-W45` -> `2026-11-02`; null unless it is the canonical key of a week that exists */
export function mondayFromWeekParam(param: string): string | null {
	if (!WEEK_PARAM_PATTERN.test(param)) return null;
	return parseCalendarWeekKey(param)?.weekStart ?? null;
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
		// An old ISO-only bookmark (`2026-W53`) opens the same Monday's week (057-DR)
		const legacyKey = legacyIsoWeekRedirect(segments[1]);
		const monday = mondayFromWeekParam(legacyKey ?? segments[1]);
		return monday ? { kind: 'time', week: monday } : null;
	}
	// The trash (`/notes/trash`, sprint 043-CL) is its own page, not a workspace URL
	if (segments[0] === 'notes' && segments[1] === TRASH_SEGMENT) return null;
	if (segments[0] === 'notes' && segments[1] === CLIENT_SEGMENT) {
		if (segments.length === 3) return { kind: 'client', clientId: segments[2], contractId: null, noteId: null, draft: false };
		if (segments.length !== 5) return null;
		const draft = segments[4] === DRAFT_SEGMENT;
		return { kind: 'client', clientId: segments[2], contractId: segments[3], noteId: draft ? null : segments[4], draft };
	}
	if (segments[0] === 'notes' && segments[1] === ALL_NOTES_SEGMENT) {
		if (segments.length === 2) return { kind: 'all', contractId: null, noteId: null, draft: false };
		if (segments.length !== 4) return null;
		const draft = segments[3] === DRAFT_SEGMENT;
		return { kind: 'all', contractId: segments[2], noteId: draft ? null : segments[3], draft };
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
		case 'client': {
			const base = `/notes/${CLIENT_SEGMENT}/${encodeURIComponent(route.clientId)}`;
			if (!route.contractId || (!route.noteId && !route.draft)) return base;
			const contractBase = `${base}/${encodeURIComponent(route.contractId)}`;
			return route.draft ? `${contractBase}/${DRAFT_SEGMENT}` : `${contractBase}/${encodeURIComponent(route.noteId ?? '')}`;
		}
		case 'all': {
			if (!route.contractId || (!route.noteId && !route.draft)) return ALL_NOTES_PATH;
			const contractBase = `${ALL_NOTES_PATH}/${encodeURIComponent(route.contractId)}`;
			return route.draft ? `${contractBase}/${DRAFT_SEGMENT}` : `${contractBase}/${encodeURIComponent(route.noteId ?? '')}`;
		}
	}
}

/** The list a route shows: a contract's notes, a client's notes (039-CL), all notes (051-UI), or none */
export function isNoteListRoute(
	route: WorkspaceRoute
): route is Extract<WorkspaceRoute, { kind: 'notes' | 'client' | 'all' }> {
	return route.kind === 'notes' || route.kind === 'client' || route.kind === 'all';
}

/** Phone drill-down depth: home = sidebar (0); timesheet or note list = 1; a note or draft = 2 */
export function mobileLevelFor(route: WorkspaceRoute): 0 | 1 | 2 {
	if (route.kind === 'home') return 0;
	if (isNoteListRoute(route) && (route.noteId || route.draft)) return 2;
	return 1;
}

/** One level up: note -> its contract's (or client's, or all notes) list; list or timesheet -> home */
export function parentRoute(route: WorkspaceRoute): WorkspaceRoute {
	if (route.kind === 'notes' && (route.noteId || route.draft)) {
		return { kind: 'notes', contractId: route.contractId, noteId: null, draft: false };
	}
	if (route.kind === 'client' && (route.noteId || route.draft)) {
		return { kind: 'client', clientId: route.clientId, contractId: null, noteId: null, draft: false };
	}
	if (route.kind === 'all' && (route.noteId || route.draft)) {
		return { kind: 'all', contractId: null, noteId: null, draft: false };
	}
	return { kind: 'home' };
}

export function sameRoute(first: WorkspaceRoute, second: WorkspaceRoute): boolean {
	return buildWorkspacePath(first) === buildWorkspacePath(second);
}
