/**
 * Seed for the sprint 064-DR notes polish specs: client "Amplitude" with "Rank Group" (a long note
 * linked from two time entries, one on Rank Group and one on another client's "Garden") and
 * "Retainer"; client "Birch" with "Garden". Created through the API as the signed-in user.
 */
import { expect, type Page } from '@playwright/test';

export type NotesPolishSeed = {
	clientId: string;
	clientName: string;
	contractId: string;
	contractName: string;
	otherContractName: string;
	longNoteId: string;
	shortNoteId: string;
};

export async function seedNotesPolish(page: Page): Promise<NotesPolishSeed> {
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	await page.goto('/');
	return page.evaluate(async (suffix) => {
		const post = async (url: string, body: unknown) => {
			const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
			return response.json();
		};
		const code = suffix.slice(-4).toUpperCase();
		const clientName = `Amplitude ${suffix}`;
		const clientId = (await post('/api/clients', { name: clientName, shortCode: `M${code}` })).client.id;
		const otherClientId = (await post('/api/clients', { name: `Birch ${suffix}`, shortCode: `B${code}` })).client.id;
		const contractName = `Rank Group ${suffix}`;
		const contractId = (await post('/api/contracts', { clientId, name: contractName, isActive: true })).contract.id;
		await post('/api/contracts', { clientId, name: `Retainer ${suffix}`, isActive: true });
		const otherContractName = `Garden ${suffix}`;
		const otherContractId = (await post('/api/contracts', { clientId: otherClientId, name: otherContractName, isActive: true })).contract.id;
		const longNoteId = (await post('/api/notes', { contractId, title: 'Specific response to Brent', content: '# Specific response to Brent\n\nSeparate isolates cannot share the SDK singleton.' })).note.id;
		await new Promise((resolve) => setTimeout(resolve, 20));
		const shortNoteId = (await post('/api/notes', { contractId, title: 'First call plan', content: '# First call plan\n\nProposed walkthrough.' })).note.id;
		await post('/api/time-entries', { date: '2026-11-03', durationMinutes: 20, contractId, description: `Reply drafted [[${longNoteId}]]` });
		await post('/api/time-entries', { date: '2026-11-04', durationMinutes: 45, contractId: otherContractId, description: `Cross-client call [[${longNoteId}]]` });
		return { clientId, clientName, contractId, contractName, otherContractName, longNoteId, shortNoteId };
	}, suffix);
}

/** How many time entries the server still links to the note */
export async function linkedEntryCount(page: Page, noteId: string): Promise<number> {
	return page.evaluate(async (noteId) => {
		const response = await fetch(`/api/notes/${encodeURIComponent(noteId)}/time-entries`);
		const body = await response.json();
		return (body.timeEntries ?? []).length;
	}, noteId);
}

export async function openSeededNote(page: Page, seed: NotesPolishSeed, noteId = seed.longNoteId) {
	await page.goto(`/notes/${seed.contractId}/${noteId}`);
	await expect(page.locator('[data-note-editor-content] .tiptap')).toBeVisible();
	await page.waitForLoadState('networkidle');
}
