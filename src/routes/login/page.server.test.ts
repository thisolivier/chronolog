import { describe, expect, it } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { load } from './+page.server';

/** Build a minimal load event; only `locals` and `isDataRequest` matter for this load. */
function buildLoadEvent(user: App.Locals['user'], isDataRequest: boolean = false) {
	return {
		locals: { user, session: null },
		isDataRequest
	} as unknown as Parameters<typeof load>[0];
}

const authenticatedUser = { id: 'user-1', email: 'olivier@example.com' } as App.Locals['user'];

describe('/login page server load', () => {
	it('redirects an authenticated user to / with a 303 on a document request', async () => {
		let thrownValue: unknown;
		try {
			await load(buildLoadEvent(authenticatedUser));
		} catch (caught) {
			thrownValue = caught;
		}

		expect(thrownValue).toBeDefined();
		expect(isRedirect(thrownValue)).toBe(true);
		expect(thrownValue).toMatchObject({ status: 303, location: '/' });
	});

	it('flags an authenticated client-side navigation instead of redirecting it', async () => {
		await expect(load(buildLoadEvent(authenticatedUser, true))).resolves.toEqual({
			alreadyAuthenticated: true
		});
	});

	it('resolves normally when there is no authenticated user', async () => {
		await expect(load(buildLoadEvent(null))).resolves.toEqual({ alreadyAuthenticated: false });
	});
});
