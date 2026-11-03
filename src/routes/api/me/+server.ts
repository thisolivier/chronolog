import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/api-errors';
import { isValidTimezone, localCalendar } from '$lib/utils/local-calendar';

/**
 * GET /api/me[?tz=Europe/London]
 *
 * Who is calling, how (`session` or `token`), and the calendar a client needs to resolve
 * "today" and "this week": `today`, `isoWeek` (`2026-W45`), `weekStart`, `weekEnd`, all in the
 * caller's timezone (`tz` query or `X-Timezone` header; default the server's zone).
 */
export const GET: RequestHandler = async ({ locals, url, request }) => {
	const currentUser = locals.user;
	if (!currentUser) return apiError(401, 'Unauthorized', 'unauthorized');

	const requestedTimezone = url.searchParams.get('tz') ?? request.headers.get('x-timezone');
	const serverTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	if (requestedTimezone && !isValidTimezone(requestedTimezone)) {
		return apiError(400, `Unknown timezone “${requestedTimezone}”`, 'invalid_timezone');
	}

	return json({
		user: { id: currentUser.id, email: currentUser.email, name: currentUser.name },
		authenticatedBy: locals.session ? 'session' : 'token',
		...localCalendar(new Date(), requestedTimezone || serverTimezone)
	});
};
