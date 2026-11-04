import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/api-errors';
import { readRequestTimezone } from '$lib/server/api-request';
import { localCalendar } from '$lib/utils/local-calendar';
import { SERVER_VERSION, serverBuildCommit } from './server-version';

/**
 * GET /api/me[?tz=Europe/London]
 *
 * Who is calling, how (`session` or `token`), and the calendar a client needs to resolve
 * "today" and "this week": `today`, `isoWeek` (`2026-W45`), `weekStart`, `weekEnd`, all in the
 * caller's timezone (`tz` query or `X-Timezone` header; default the server's zone).
 * `POST /api/notes` dates new note IDs from the same source. `serverVersion` is the app's
 * `package.json` version and `serverCommit` the git commit the image was built from (`dev` when
 * run from a checkout), so the CLI can tell which server it talks to and warn when it drifts.
 */
export const GET: RequestHandler = async ({ locals, url, request }) => {
	const currentUser = locals.user;
	if (!currentUser) return apiError(401, 'Unauthorized', 'unauthorized');

	const timezoneResult = readRequestTimezone(url, request);
	if (!timezoneResult.ok) return timezoneResult.response;

	return json({
		user: { id: currentUser.id, email: currentUser.email, name: currentUser.name },
		authenticatedBy: locals.session ? 'session' : 'token',
		serverVersion: SERVER_VERSION,
		serverCommit: serverBuildCommit(),
		...localCalendar(new Date(), timezoneResult.timezone)
	});
};
