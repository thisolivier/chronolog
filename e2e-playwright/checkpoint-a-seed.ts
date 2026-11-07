/**
 * Checkpoint A (design r1) seed: the spec mock-ups' names, for a fresh user, so the acceptance
 * walk and the owner's screenshots read like real work rather than test suffixes.
 * - Amplitude: Hungryroot (a long note and a short one), Daily Pay (one note), Rank Group (one note
 *   linking to the Daily Pay note)
 * - EasyJet: Crew Rostering (one note)
 * - Internal / General: created by the app for every new user
 * Linked time: two entries on the long Hungryroot note, one of them from Rank Group.
 */
import type { Page } from '@playwright/test';

export type CheckpointSeed = {
	amplitudeId: string;
	hungryrootId: string;
	dailyPayId: string;
	rankGroupId: string;
	easyJetContractId: string;
	longNoteId: string;
	shortNoteId: string;
	dailyPayNoteId: string;
	rankGroupNoteId: string;
};

export async function seedCheckpoint(page: Page): Promise<CheckpointSeed> {
	await page.goto('/');
	return page.evaluate(async () => {
		const post = async (url: string, body: unknown) => {
			const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
			return response.json();
		};
		const pause = () => new Promise((resolve) => setTimeout(resolve, 20));
		const amplitudeId = (await post('/api/clients', { name: 'Amplitude', shortCode: 'AMP' })).client.id;
		const easyJetId = (await post('/api/clients', { name: 'EasyJet', shortCode: 'EZY' })).client.id;
		const contract = async (clientId: string, name: string) => (await post('/api/contracts', { clientId, name, isActive: true })).contract.id as string;
		const hungryrootId = await contract(amplitudeId, 'Hungryroot');
		const dailyPayId = await contract(amplitudeId, 'Daily Pay');
		const rankGroupId = await contract(amplitudeId, 'Rank Group');
		const easyJetContractId = await contract(easyJetId, 'Crew Rostering');
		const note = async (contractId: string, title: string, body: string) =>
			(await post('/api/notes', { contractId, title, content: `# ${title}\n\n${body}` })).note.id as string;

		const paragraphs = [
			'Brent asked whether the event pipeline can share one SDK instance across the worker isolates.',
			'Separate isolates have different memory, so they cannot share the singleton; each one initialises its own client.',
			'Batching is per isolate as well, which explains the uneven flush sizes in the dashboard.',
			'Recommendation: keep one client per isolate, lower the flush interval to five seconds, and tag events with the isolate id.',
			'Follow-up: confirm the retention window for the raw event export before the next review.'
		];
		const longBody = Array.from({ length: 12 }, (_, round) => paragraphs.map((text) => `${text}${round ? ` (${round + 1})` : ''}`).join('\n\n')).join('\n\n');
		const longNoteId = await note(hungryrootId, 'Specific response to Brent', longBody);
		await pause();
		const shortNoteId = await note(hungryrootId, 'Kick-off agenda', '- Goals for the quarter\n- Event taxonomy review\n- [ ] Share the tracking plan');
		const dailyPayNoteId = await note(dailyPayId, 'Payroll integration questions', 'Which payroll providers send webhooks, and how often do they retry?');
		const rankGroupNoteId = await note(rankGroupId, 'Pricing review', `Tiered pricing options for the loyalty programme. Open questions are in [[${dailyPayNoteId}]].`);
		await note(easyJetContractId, 'Crew rostering workshop', 'Constraints from the union agreement and the summer schedule.');

		const today = new Date().toISOString().slice(0, 10);
		await post('/api/time-entries', { date: today, durationMinutes: 50, contractId: hungryrootId, description: `Drafted the reply [[${longNoteId}]]` });
		await post('/api/time-entries', { date: today, durationMinutes: 25, contractId: rankGroupId, description: `Compared notes with Rank Group [[${longNoteId}]]` });
		return { amplitudeId, hungryrootId, dailyPayId, rankGroupId, easyJetContractId, longNoteId, shortNoteId, dailyPayNoteId, rankGroupNoteId };
	});
}

/** The running timer as the server sees it (null when none) */
export async function serverTimer(page: Page): Promise<{ id: string; contractId: string | null; description: string | null } | null> {
	return page.evaluate(async () => (await (await fetch('/api/timer/status')).json()).timer ?? null);
}
