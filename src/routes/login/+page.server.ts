import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * An already-authenticated user has no reason to see the login form: a 303 to `/`, for a
 * document request (typing /login, a bookmark, a reload) and a client-side navigation alike (the
 * register page's `goto('/login')` after Better Auth signs the new user in). In SvelteKit 2
 * `redirect()` throws itself, so it must not be wrapped in `throw` or a `try` block.
 *
 * Until 044-CL a client-side navigation got `{ alreadyAuthenticated: true }` instead and the page
 * reloaded itself, because the root layout only created the navigation context when the first
 * page had a user. The root layout now always creates it.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, '/');
	return {};
};
