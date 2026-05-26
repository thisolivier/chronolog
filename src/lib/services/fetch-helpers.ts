/**
 * Shared HTTP helpers used by FetchDataService.
 * Each helper checks response.ok and throws a descriptive error on failure.
 */

export async function fetchJson<ResponseType>(
	url: string,
	options?: RequestInit
): Promise<ResponseType> {
	const response = await fetch(url, options);
	if (!response.ok) {
		const errorText = await response.text().catch(() => 'Unknown error');
		throw new Error(
			`${options?.method ?? 'GET'} ${url} failed (${response.status}): ${errorText}`
		);
	}
	return response.json() as Promise<ResponseType>;
}

export async function postJson<ResponseType>(url: string, body: unknown): Promise<ResponseType> {
	return fetchJson<ResponseType>(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

export async function putJson<ResponseType>(url: string, body: unknown): Promise<ResponseType> {
	return fetchJson<ResponseType>(url, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

export async function deleteRequest<ResponseType = void>(
	url: string,
	body?: unknown
): Promise<ResponseType> {
	const options: RequestInit = { method: 'DELETE' };
	if (body !== undefined) {
		options.headers = { 'Content-Type': 'application/json' };
		options.body = JSON.stringify(body);
	}
	return fetchJson<ResponseType>(url, options);
}
