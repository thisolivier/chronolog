/**
 * E2E Tests: link text in note titles and previews (sprint 043-CL)
 *
 * Wiki-links read as the target's title (or their label, or the ID when unknown) in the list's
 * titles and previews, the titles lookup and the trash; attachment links read as their filename.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import './test-init';
import { authDelete, authGet, authPost } from './helpers';

type ListedNote = { id: string; displayTitle: string | null; firstLine: string; secondLine: string };

describe('Note titles and previews with links', () => {
	let contractId: string;
	let alphaId: string;
	let betaId: string;
	let filedId: string;

	const createNote = async (content: string) => {
		const response = await authPost('/api/notes', { contractId, content });
		expect(response.status).toBe(201);
		return (await response.json()).note.id as string;
	};

	beforeAll(async () => {
		const contracts = await (await authGet('/api/contracts')).json();
		contractId = contracts.find((contract: { name: string }) => contract.name === 'General').id;
		alphaId = await createNote('# Alpha plan\n\nThe details.');
		betaId = await createNote(`Beta links to [[${alphaId}]] and [[NOPE.20260101.001]]\n\nSee [[${alphaId}|the plan]].`);
		filedId = await createNote('# Filed\n[invoice.pdf](chronolog://attachment/550e8400-e29b-41d4-a716-446655440000) signed');
	});

	it('GET /api/notes reads links as text in titles and previews', async () => {
		const notes: ListedNote[] = (await (await authGet(`/api/notes?contractId=${contractId}`)).json()).notes;
		const beta = notes.find((note) => note.id === betaId);
		expect(beta?.displayTitle).toBe('Beta links to Alpha plan and NOPE.20260101.001');
		expect(beta?.secondLine).toBe('See the plan.');
		const filed = notes.find((note) => note.id === filedId);
		expect(filed?.secondLine).toBe('invoice.pdf signed');
	});

	it('GET /api/notes/titles names notes created as markdown, links included', async () => {
		const response = await authGet(`/api/notes/titles?ids=${alphaId},${betaId}`);
		const titles: Array<{ id: string; displayTitle: string | null }> = (await response.json()).titles;
		expect(titles.find((title) => title.id === alphaId)?.displayTitle).toBe('Alpha plan');
		expect(titles.find((title) => title.id === betaId)?.displayTitle).toBe('Beta links to Alpha plan and NOPE.20260101.001');
	});

	it('GET /api/notes/trash titles a trashed note with its link text', async () => {
		expect((await authDelete(`/api/notes/${betaId}`)).ok).toBe(true);
		const trashed: Array<{ id: string; title: string | null }> = (await (await authGet('/api/notes/trash')).json()).notes;
		expect(trashed.find((note) => note.id === betaId)?.title).toBe('Beta links to Alpha plan and NOPE.20260101.001');
		await authPost(`/api/notes/${betaId}/restore`, {});
	});
});
