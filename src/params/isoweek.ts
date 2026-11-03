import type { ParamMatcher } from '@sveltejs/kit';
import { mondayFromWeekParam } from '$lib/stores/navigation-routes';

/** `[week=isoweek]`: `2026-W45`; anything else (or week 53 of a 52-week year) is a 404 */
export const match: ParamMatcher = (param) => mondayFromWeekParam(param) !== null;
