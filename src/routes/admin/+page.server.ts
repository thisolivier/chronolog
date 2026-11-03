import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** The old Admin landing page is now the Settings page, which links clients and two-factor. */
export const load: PageServerLoad = async () => {
	redirect(307, '/settings');
};
