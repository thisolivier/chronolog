/** Sprint 039-CL: `note pin|unpin`, the pin marker in `notes`, `client edit --order`. */
import { describe, expect, it } from 'vitest';
import { notePin, noteUnpin, PIN_MARKER } from './note-pins.mjs';
import { notes } from './read.mjs';
import { clientEdit } from './manage-clients.mjs';
import { ApiError } from '../lib/api.mjs';
import { ReferenceError_ } from '../lib/resolve.mjs';
import { UsageError } from '../lib/args.mjs';

const CLIENT = { id: '11111111-1111-4111-8111-111111111111', name: 'Acme Ltd', shortCode: 'ACME', archived: false };
const CONTRACT = { id: '22222222-2222-4222-8222-222222222222', name: 'Website', clientId: CLIENT.id, clientName: 'Acme Ltd', clientShortCode: 'ACME', isActive: true };

function recorder() {
	const printed = [];
	return { printed, print: (text, value) => printed.push({ text, value }) };
}

describe('note pin / unpin', () => {
	it('PUTs { pinned } to the pin route and says so', async () => {
		const calls = [];
		const api = { put: async (path, body) => (calls.push({ path, body }), { note: { id: 'ACME.20261104.001', isPinned: body.pinned } }) };
		const output = recorder();
		await notePin({ api, ...output, positionals: ['ACME.20261104.001'] });
		await noteUnpin({ api, ...output, positionals: ['ACME.20261104.001'] });
		expect(calls).toEqual([
			{ path: '/api/notes/ACME.20261104.001/pin', body: { pinned: true } },
			{ path: '/api/notes/ACME.20261104.001/pin', body: { pinned: false } }
		]);
		expect(output.printed[0].text).toContain('Pinned ACME.20261104.001');
		expect(output.printed[1].text).toBe('Unpinned ACME.20261104.001.');
	});

	it('needs an id, and turns a 404 into an unknown reference (exit 3)', async () => {
		await expect(notePin({ api: {}, print: () => {}, positionals: [] })).rejects.toBeInstanceOf(UsageError);
		const api = { put: async () => { throw new ApiError(404, 'Note not found', 'note_not_found'); } };
		await expect(noteUnpin({ api, print: () => {}, positionals: ['NOPE.1'] })).rejects.toBeInstanceOf(ReferenceError_);
	});
});

describe('notes list', () => {
	it('marks pinned notes', async () => {
		const api = {
			get: async (path) =>
				path.startsWith('/api/contracts-by-client')
					? { contracts: [CONTRACT] }
					: { notes: [
						{ id: 'ACME.1', isPinned: true, updatedAt: '2026-11-01T10:00:00Z', displayTitle: 'Pinned plan' },
						{ id: 'ACME.2', isPinned: false, updatedAt: '2026-11-04T10:00:00Z', displayTitle: 'Latest' }
					] }
		};
		const output = recorder();
		await notes({ api, ...output, positionals: ['ACME/Website'], flags: {} });
		const lines = output.printed[0].text.split('\n');
		expect(lines[1]).toBe(`${PIN_MARKER} ACME.1  2026-11-01  Pinned plan`);
		expect(lines[2]).toBe('ACME.2  2026-11-04  Latest');
	});
});

describe('client edit --order', () => {
	it('sends position and prints where the client landed', async () => {
		const calls = [];
		const api = {
			get: async () => ({ clients: [CLIENT] }),
			patch: async (path, body) => (calls.push({ path, body }), { client: CLIENT, message: '', position: 2 })
		};
		const output = recorder();
		await clientEdit({ api, ...output, positionals: ['ACME'], flags: { order: '2' } });
		expect(calls).toEqual([{ path: `/api/clients/${CLIENT.id}`, body: { position: 2 } }]);
		expect(output.printed[0].text).toContain('number 2 in the sidebar');
		expect(output.printed[0].value.position).toBe(2);
	});

	it('refuses an order that is not a whole number from 1', async () => {
		for (const order of ['0', '-1', 'top', '1.5']) {
			await expect(clientEdit({ api: {}, print: () => {}, positionals: ['ACME'], flags: { order } })).rejects.toThrow('--order');
		}
	});
});
