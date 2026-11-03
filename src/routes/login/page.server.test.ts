import { describe, expect, it } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { load } from './+page.server';

/** Build a minimal load event; only `locals` matters for this load. */
function buildLoadEvent(user: App.Locals['user']) {
	return { locals: { user, session: null } } as unknown as Parameters<typeof load>[0];
}

describe('/login page server load', () => {
	it('redirects an authenticated user to / with a 303', async () => {
		const authenticatedUser = { id: 'user-1', email: 'olivier@example.com' } as App.Locals['user'];

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

	it('resolves normally when there is no authenticated user', async () => {
		await expect(load(buildLoadEvent(null))).resolves.toEqual({});
	});
});
