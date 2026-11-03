import { describe, expect, it } from 'vitest';
import { readJsonObject, readRequestTimezone, serverTimezone } from './api-request';

function postRequest(body: string): Request {
	return new Request('http://localhost/api/x', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body
	});
}

describe('readJsonObject', () => {
	it('returns the parsed object', async () => {
		const result = await readJsonObject(postRequest('{"contractId":"abc"}'));
		expect(result).toEqual({ ok: true, body: { contractId: 'abc' } });
	});

	it.each([['not json'], [''], ['null'], ['[1,2]'], ['"text"'], ['42']])(
		'turns %j into a 400 invalid_json',
		async (rawBody) => {
			const result = await readJsonObject(postRequest(rawBody));
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.response.status).toBe(400);
			expect((await result.response.json()).code).toBe('invalid_json');
		}
	);
});

describe('readRequestTimezone', () => {
	it('prefers ?tz= then X-Timezone then the server zone', () => {
		const withHeader = new Request('http://localhost/api/x', { headers: { 'X-Timezone': 'Asia/Tokyo' } });
		expect(readRequestTimezone(new URL('http://localhost/api/x?tz=Europe/London'), withHeader)).toEqual({ ok: true, timezone: 'Europe/London' });
		expect(readRequestTimezone(new URL('http://localhost/api/x'), withHeader)).toEqual({ ok: true, timezone: 'Asia/Tokyo' });
		expect(readRequestTimezone(new URL('http://localhost/api/x'), new Request('http://localhost/api/x'))).toEqual({ ok: true, timezone: serverTimezone() });
	});

	it('rejects an unknown zone with 400 invalid_timezone', async () => {
		const result = readRequestTimezone(new URL('http://localhost/api/x?tz=Mars/Base'), new Request('http://localhost/api/x'));
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.response.status).toBe(400);
		expect((await result.response.json()).code).toBe('invalid_timezone');
	});
});
