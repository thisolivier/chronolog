/**
 * HTTP client for the Chronolog REST API: bearer token, device key header, the laptop's
 * timezone, JSON in and out. Non-2xx answers throw `ApiError` with the server's
 * `{ error, code }` and the HTTP status.
 */

export class ApiError extends Error {
	constructor(status, message, code) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

export function createApiClient(config, fetchImplementation = globalThis.fetch) {
	if (!config.baseUrl) throw new ApiError(0, 'No server configured. Run `chronolog init`.', 'not_configured');
	if (!config.apiToken) throw new ApiError(0, 'No API token configured. Run `chronolog init`.', 'not_configured');

	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	async function request(method, path, body) {
		const headers = {
			Accept: 'application/json',
			Authorization: `Bearer ${config.apiToken}`,
			'X-Timezone': timezone
		};
		if (config.deviceKey) headers['X-Device-Key'] = config.deviceKey;
		if (body !== undefined) headers['Content-Type'] = 'application/json';

		let response;
		try {
			response = await fetchImplementation(`${config.baseUrl}${path}`, {
				method,
				headers,
				body: body === undefined ? undefined : JSON.stringify(body),
				redirect: 'manual'
			});
		} catch (networkError) {
			throw new ApiError(0, `Cannot reach ${config.baseUrl}: ${networkError.cause?.code ?? networkError.message}`, 'network');
		}

		const text = await response.text();
		let parsed = null;
		try {
			parsed = text ? JSON.parse(text) : null;
		} catch {
			parsed = null;
		}
		if (!response.ok) {
			const message = parsed?.error ?? parsed?.message ?? `HTTP ${response.status}`;
			throw new ApiError(response.status, message, parsed?.code ?? `http_${response.status}`);
		}
		return parsed;
	}

	return {
		get: (path) => request('GET', path),
		post: (path, body) => request('POST', path, body ?? {}),
		put: (path, body) => request('PUT', path, body ?? {}),
		patch: (path, body) => request('PATCH', path, body ?? {}),
		delete: (path) => request('DELETE', path)
	};
}
