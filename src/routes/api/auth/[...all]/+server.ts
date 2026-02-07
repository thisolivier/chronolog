import { auth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Catch-all handler that forwards requests to Better Auth.
 * Better Auth's auth.handler is a standard web Request -> Response function.
 */
const handleAuthRequest: RequestHandler = async ({ request }) => {
	return auth.handler(request);
};

export const GET = handleAuthRequest;
export const POST = handleAuthRequest;
