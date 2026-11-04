import { describe, expect, it } from 'vitest';
import { clientAdd, clientEdit, clientRemove, contractEdit } from './manage-clients.mjs';
import { deliverableRemove, workTypeAdd } from './manage-structure.mjs';
import { findDeliverable, findWorkType } from '../lib/object-refs.mjs';
import { commandFromPositionals, parseArguments, UsageError } from '../lib/args.mjs';
import { ReferenceError_, splitObjectPath } from '../lib/resolve.mjs';

const CLIENT = { id: '11111111-1111-4111-8111-111111111111', name: 'Acme Ltd', shortCode: 'ACME', archived: false };
const CONTRACT = { id: '22222222-2222-4222-8222-222222222222', name: 'Website', clientId: CLIENT.id, clientName: 'Acme Ltd', clientShortCode: 'ACME', isActive: true };
const DELIVERABLE = { id: '33333333-3333-4333-8333-333333333333', name: 'Phase 1', contractId: CONTRACT.id, sortOrder: 0 };
const WORK_TYPE = { id: '44444444-4444-4444-8444-444444444444', name: 'Design', deliverableId: DELIVERABLE.id, sortOrder: 0 };
const notATerminal = { isTTY: false };

function fakeApi(responses = {}) {
	const calls = [];
	const respond = (method) => async (path, body) => {
		calls.push({ method, path, body });
		const handler = responses[`${method} ${path.split('?')[0]}`];
		if (handler === undefined) throw new Error(`unexpected ${method} ${path}`);
		return typeof handler === 'function' ? handler(body, path) : handler;
	};
	return { calls, get: respond('GET'), post: respond('POST'), patch: respond('PATCH'), delete: respond('DELETE') };
}

const referenceData = {
	'GET /api/clients': { clients: [CLIENT] },
	'GET /api/contracts-by-client': { contracts: [CONTRACT] },
	'GET /api/deliverables': [DELIVERABLE],
	'GET /api/work-types': [WORK_TYPE]
};

describe('command routing', () => {
	it('reads two-word commands and the tag aliases', () => {
		expect(commandFromPositionals(['client', 'add', 'Acme'])).toEqual({ commandName: 'client add', rest: ['Acme'] });
		expect(commandFromPositionals(['tag', 'add', 'A/B/C', 'Design'])).toEqual({ commandName: 'work-type add', rest: ['A/B/C', 'Design'] });
		expect(commandFromPositionals(['tags', 'A/B/C'])).toEqual({ commandName: 'work-types', rest: ['A/B/C'] });
		expect(commandFromPositionals(['contracts', 'acme'])).toEqual({ commandName: 'contracts', rest: ['acme'] });
	});

	it('treats --yes, -y, --all, --inactive as switches', () => {
		expect(parseArguments(['client', 'remove', 'ACME', '-y', '--all', '--inactive']).flags).toEqual({ yes: true, all: true, inactive: true });
	});
});

describe('path references', () => {
	it('splits SHORT/Contract/Deliverable/WorkType and refuses a short path', () => {
		expect(splitObjectPath('ACME/Website/Phase 1/Design', 4, 'work type')).toEqual({
			contractReference: 'ACME/Website',
			deliverableName: 'Phase 1',
			workTypeName: 'Design'
		});
		expect(splitObjectPath('ACME/Website/Phase 1/2', 3, 'deliverable').deliverableName).toBe('Phase 1/2');
		expect(() => splitObjectPath('ACME/Website', 3, 'deliverable')).toThrow(ReferenceError_);
	});

	it('finds a deliverable and a work type segment by segment', async () => {
		const api = fakeApi(referenceData);
		expect((await findDeliverable(api, 'acme/website/phase 1')).contract.id).toBe(CONTRACT.id);
		const workType = await findWorkType(api, 'ACME/Website/Phase 1/design');
		expect(workType.id).toBe(WORK_TYPE.id);
		expect(workType.deliverable.id).toBe(DELIVERABLE.id);
		// archived objects are found too, so they can be restored
		expect(api.calls.filter((call) => call.path.startsWith('/api/contracts-by-client')).every((call) => call.path.endsWith('?includeArchived=true'))).toBe(true);
	});

	it('fails with candidates for an unknown segment', async () => {
		await expect(findWorkType(fakeApi(referenceData), 'ACME/Website/Phase 1/Testing')).rejects.toMatchObject({
			code: 'not_found',
			candidates: [`Design  id=${WORK_TYPE.id}`]
		});
	});
});

describe('client and contract commands', () => {
	it('client add sends name, code and emoji, never a guessed code', async () => {
		const api = fakeApi({ 'POST /api/clients': (body) => ({ client: { ...CLIENT, ...body, id: CLIENT.id } }) });
		await clientAdd({ api, print: () => {}, positionals: ['Acme', 'Ltd'], flags: { code: 'ACME', emoji: '🚀' } });
		expect(api.calls[0].body).toEqual({ name: 'Acme Ltd', shortCode: 'ACME', emoji: '🚀' });
		await expect(clientAdd({ api, print: () => {}, positionals: ['Acme'], flags: {} })).rejects.toThrow(UsageError);
	});

	it('client edit sends only the flags given and clears the emoji with none', async () => {
		const api = fakeApi({ ...referenceData, [`PATCH /api/clients/${CLIENT.id}`]: (body) => ({ client: { ...CLIENT, ...body } }) });
		await clientEdit({ api, print: () => {}, positionals: ['acme'], flags: { code: 'ACM', emoji: 'none' } });
		expect(api.calls.at(-1).body).toEqual({ shortCode: 'ACM', emoji: null });
		await expect(clientEdit({ api, print: () => {}, positionals: ['acme'], flags: {} })).rejects.toThrow('Nothing to change');
	});

	it('contract edit maps --inactive and --description none', async () => {
		const api = fakeApi({ ...referenceData, [`PATCH /api/contracts/${CONTRACT.id}`]: (body) => ({ contract: { ...CONTRACT, ...body } }) });
		await contractEdit({ api, print: () => {}, positionals: ['ACME/Website'], flags: { inactive: true, description: 'none' } });
		expect(api.calls.at(-1).body).toEqual({ isActive: false, description: null });
	});

	it('client remove refuses without --yes when there is no terminal, and deletes with it', async () => {
		const responses = {
			...referenceData,
			[`GET /api/clients/${CLIENT.id}`]: { client: CLIENT, usage: { timeEntryCount: 3, totalMinutes: 270, noteCount: 1 } },
			[`DELETE /api/clients/${CLIENT.id}`]: { message: 'Deleted “Acme Ltd”.', reassignedTimeEntryCount: 3 }
		};
		const refused = fakeApi(responses);
		await expect(clientRemove({ api: refused, print: () => {}, positionals: ['ACME'], flags: {}, stdin: notATerminal })).rejects.toThrow(
			/3 time entries \(4h30m\) and 1 note[\s\S]*--yes/
		);
		expect(refused.calls.some((call) => call.method === 'DELETE')).toBe(false);

		const confirmed = fakeApi(responses);
		const printed = [];
		await clientRemove({ api: confirmed, print: (text) => printed.push(text), positionals: ['ACME'], flags: { yes: true }, stdin: notATerminal });
		expect(confirmed.calls.at(-1)).toMatchObject({ method: 'DELETE', path: `/api/clients/${CLIENT.id}` });
		expect(printed[0]).toBe('Deleted “Acme Ltd”.');
	});
});

describe('deliverable and work type commands', () => {
	it('work-type add posts to the resolved deliverable', async () => {
		const api = fakeApi({ ...referenceData, 'POST /api/work-types': (body) => ({ workType: { ...WORK_TYPE, ...body } }) });
		await workTypeAdd({ api, print: () => {}, positionals: ['ACME/Website/Phase 1', 'Build'], flags: { order: '2' } });
		expect(api.calls.at(-1).body).toEqual({ deliverableId: DELIVERABLE.id, name: 'Build', sortOrder: 2 });
	});

	it('deliverable remove also needs --yes', async () => {
		const api = fakeApi({ ...referenceData, [`GET /api/deliverables/${DELIVERABLE.id}`]: { deliverable: DELIVERABLE, usage: { timeEntryCount: 0, totalMinutes: 0 } } });
		await expect(deliverableRemove({ api, print: () => {}, positionals: ['ACME/Website/Phase 1'], flags: {}, stdin: notATerminal })).rejects.toThrow(UsageError);
	});
});
