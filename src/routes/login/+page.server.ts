import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * An already-authenticated user has no reason to see the login form.
 *
 * For a document request (typing /login, a bookmark, a full reload) we
 * answer with a 303 to `/`, which renders the root layout with the user and
 * so sets up the navigation/timer contexts. In SvelteKit 2 `redirect()`
 * throws itself, so it must not be wrapped in `throw` or a `try` block.
 *
 * For a client-side navigation (e.g. the register page's `goto('/login')`
 * after Better Auth auto-signs the new user in) the root layout has already
 * mounted without a user, so following the redirect in the client router
 * lands on `/` with no navigation context. In that case we leave the
 * redirect to the page, which performs a full reload instead.
 */
export const load: PageServerLoad = async ({ locals, isDataRequest }) => {
	if (!locals.user) {
		return { alreadyAuthenticated: false };
	}

	if (!isDataRequest) {
		redirect(303, '/');
	}

	return { alreadyAuthenticated: true };
};
