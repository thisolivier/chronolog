import type { ParamMatcher } from '@sveltejs/kit';
import { mondayFromWeekParam } from '$lib/stores/navigation-routes';

/**
 * `[week=week]`: an ISO 8601 week key, `2026-W45` (iso-week.ts). W53 matches only in 53-week ISO
 * years (`2026-W53` yes, `2025-W53` no); anything else, including a year outside 2000–2099, is a 404.
 */
export const match: ParamMatcher = (param) => mondayFromWeekParam(param) !== null;
