/**
 * HTTP client for the Chronolog REST API: bearer token, device key header, the laptop's
 * timezone, JSON in and out. Non-2xx answers throw `ApiError` with the server's
 * `{ error, code }` (or SvelteKit's `{ message }`) and the HTTP status.
 * `upload` posts multipart form data; `download` and `head` return bytes and headers (036-CL).
 */

export class ApiError extends Error {
	constructor(status, message, code) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

function parseJson(text) {
	try {
		return text ? JSON.parse(text) : null;
	} catch {
		return null;
	}
}

export function createApiClient(config, fetchImplementation = globalThis.fetch) {
	if (!config.baseUrl) throw new ApiError(0, 'No server configured. Run `chronolog init`.', 'not_configured');
	if (!config.apiToken) throw new ApiError(0, 'No API token configured. Run `chronolog init`.', 'not_configured');

	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	/** Send one request; returns the Response when 2xx, else throws ApiError. */
	async function send(method, path, { body, contentType, accept = 'application/json' } = {}) {
		const headers = {
			Accept: accept,
			Authorization: `Bearer ${config.apiToken}`,
			'X-Timezone': timezone
		};
		if (config.deviceKey) headers['X-Device-Key'] = config.deviceKey;
		if (contentType) headers['Content-Type'] = contentType;

		let response;
		try {
			response = await fetchImplementation(`${config.baseUrl}${path}`, { method, headers, body, redirect: 'manual' });
		} catch (networkError) {
			throw new ApiError(0, `Cannot reach ${config.baseUrl}: ${networkError.cause?.code ?? networkError.message}`, 'network');
		}
		if (!response.ok) {
			const parsed = parseJson(await response.text());
			const message = parsed?.error ?? parsed?.message ?? `HTTP ${response.status}`;
			throw new ApiError(response.status, message, parsed?.code ?? `http_${response.status}`);
		}
		return response;
	}

	async function request(method, path, body) {
		const response = await send(method, path, {
			body: body === undefined ? undefined : JSON.stringify(body),
			contentType: body === undefined ? undefined : 'application/json'
		});
		return parseJson(await response.text());
	}

	return {
		get: (path) => request('GET', path),
		post: (path, body) => request('POST', path, body ?? {}),
		put: (path, body) => request('PUT', path, body ?? {}),
		patch: (path, body) => request('PATCH', path, body ?? {}),
		delete: (path) => request('DELETE', path),
		/** POST a `FormData` (fetch sets the multipart boundary); returns the JSON answer. */
		upload: async (path, formData) => parseJson(await (await send('POST', path, { body: formData })).text()),
		/** GET raw bytes: `{ bytes: Buffer, headers: Headers }`. */
		download: async (path) => {
			const response = await send('GET', path, { accept: '*/*' });
			return { bytes: Buffer.from(await response.arrayBuffer()), headers: response.headers };
		},
		/** HEAD: the headers only. */
		head: async (path) => (await send('HEAD', path, { accept: '*/*' })).headers
	};
}
