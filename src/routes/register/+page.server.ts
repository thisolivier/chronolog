import { getServerEnvironment } from '$lib/server/env';
import type { PageServerLoad } from './$types';

/**
 * Tells the register page whether sign-up is open on this instance
 * (ALLOW_REGISTRATION=true). The API side is enforced by Better Auth's
 * `emailAndPassword.disableSignUp` in `$lib/server/auth`.
 */
export const load: PageServerLoad = () => {
	return {
		registrationAllowed: getServerEnvironment().allowRegistration
	};
};
