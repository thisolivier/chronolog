import type { ParamMatcher } from '@sveltejs/kit';
import { isWeekParamYearInRange, mondayFromWeekParam } from '$lib/stores/navigation-routes';
import { legacyIsoWeekRedirect } from '$lib/utils/calendar-week';

/**
 * `[week=week]`: `2026-W45` under Chronolog's week rule (calendar-week.ts). An ISO-only key from an
 * old bookmark (`2026-W53`) also matches and opens the same Monday's week (navigation-routes.ts);
 * anything else, including a year outside 2000–2099, is a 404.
 */
export const match: ParamMatcher = (param) =>
	isWeekParamYearInRange(param) && (mondayFromWeekParam(param) !== null || legacyIsoWeekRedirect(param) !== null);
