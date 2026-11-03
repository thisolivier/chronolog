import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * An already-authenticated user has no reason to see the login form,
 * so send them straight to the app. In SvelteKit 2 `redirect()` throws
 * itself, so it must not be wrapped in `throw` or a `try` block.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		redirect(303, '/');
	}
	return {};
};
