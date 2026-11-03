import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServerEnvironment } from '$lib/server/env';
import { deviceCookieValue } from '$lib/server/device-gate/device-key';
import {
	attemptDeviceKey,
	clientIpAddress,
	DEVICE_COOKIE_MAX_AGE_SECONDS,
	DEVICE_COOKIE_NAME,
	hasValidDeviceCookie
} from '$lib/server/device-gate/gate';

/** A device that is already unlocked (or a dev server with the gate off) goes straight on. */
export const load: PageServerLoad = async (event) => {
	if (getServerEnvironment().deviceAccessKeyHash === null || hasValidDeviceCookie(event)) {
		redirect(303, '/');
	}
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const configuredHash = getServerEnvironment().deviceAccessKeyHash;
		if (configuredHash === null) redirect(303, '/');

		const formData = await event.request.formData();
		const presentedKey = String(formData.get('deviceKey') ?? '').trim();
		if (presentedKey.length === 0) {
			return fail(400, { error: 'Enter the device access key.' });
		}

		const clientIp = clientIpAddress(event);
		const result = attemptDeviceKey(presentedKey, clientIp, event.url.pathname);
		if (result === 'locked') {
			return fail(429, { error: 'Too many failed attempts. Try again in 15 minutes.' });
		}
		if (result === 'rejected') {
			return fail(401, { error: 'That key is not valid for this server.' });
		}

		event.cookies.set(DEVICE_COOKIE_NAME, deviceCookieValue(configuredHash), {
			path: '/',
			httpOnly: true,
			secure: event.url.protocol === 'https:',
			sameSite: 'lax',
			maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS
		});
		console.info(`[device-gate] device unlocked ip=${clientIp}`);
		redirect(303, '/');
	}
};
