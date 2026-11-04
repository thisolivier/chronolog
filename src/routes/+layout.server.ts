import type { LayoutServerLoad } from './$types';

/**
 * What every page knows about the signed-in user. Only the fields the client uses: the page's
 * HTML and `__data.json` are kept on the device for offline use (sprint 045-CL), so the session
 * (and its token) is never sent here.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const user = locals.user;
	return {
		user: user ? { id: user.id, name: user.name, email: user.email } : null
	};
};
