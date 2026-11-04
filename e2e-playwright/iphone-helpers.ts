/**
 * Helpers for the iPhone specs (sprint 047-QA): seeding a fresh user's data, the layout checks
 * that matter on a phone (no sideways scroll, no field that makes Safari zoom, touch-sized
 * targets, a box inside the screen) and per-device review screenshots.
 */
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import path from 'node:path';
import { sprintScreenshotDirectory } from './sprint-screenshots';

export interface IphoneSeed {
	clientId: string;
	contractId: string;
	contractName: string;
	clientName: string;
	noteId: string;
	linkedNoteId: string;
	today: string;
}

/** A client with two contracts, two notes (one wiki-linking the other) and an entry today */
export async function seedIphoneData(page: Page, suffix: string): Promise<IphoneSeed> {
	await page.goto('/');
	return page.evaluate(async (suffix) => {
		const post = async (url: string, body: unknown) => {
			const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
			return response.json();
		};
		const clientName = `Acme Widgets ${suffix}`;
		const contractName = `Platform rebuild ${suffix}`;
		const clientId = (await post('/api/clients', { name: clientName, shortCode: `I${suffix.slice(-5).toUpperCase()}` })).client.id;
		const contractId = (await post('/api/contracts', { clientId, name: contractName, isActive: true })).contract.id;
		await post('/api/contracts', { clientId, name: `Support ${suffix}`, isActive: true });
		const linkedNoteId = (await post('/api/notes', { contractId, title: 'Stakeholder map', content: '# Stakeholder map\n\nPeople and roles.' })).note.id;
		const noteId = (
			await post('/api/notes', {
				contractId,
				title: 'Kickoff notes',
				content: `# Kickoff notes\n\nAgenda for the kickoff meeting, a line long enough to wrap on a phone.\n\n- [ ] Send the proposal\n- [x] Book the room\n\nSee [[${linkedNoteId}]].`
			})
		).note.id;
		const now = new Date();
		const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		await post('/api/time-entries', { date: today, durationMinutes: 90, contractId, description: `Workshop on scope ${suffix} [[${noteId}]]` });
		return { clientId, contractId, contractName, clientName, noteId, linkedNoteId, today };
	}, suffix);
}

/** The page does not scroll sideways */
export async function expectNoSidewaysScroll(page: Page): Promise<void> {
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
	expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0);
}

/** No visible text field, select or textarea is under 16px (Safari zooms in on focus) */
export async function expectNoZoomingFields(page: Page): Promise<void> {
	const smallFields = await page.evaluate(() =>
		[...document.querySelectorAll<HTMLElement>('input, select, textarea')]
			.filter((field) => !['checkbox', 'radio', 'hidden', 'range', 'color', 'file'].includes(field.getAttribute('type') ?? ''))
			.filter((field) => field.getBoundingClientRect().width > 0)
			.filter((field) => parseFloat(getComputedStyle(field).fontSize) < 16)
			.map((field) => `${field.tagName.toLowerCase()}#${field.id || field.getAttribute('aria-label') || field.getAttribute('placeholder')}`)
	);
	expect(smallFields, 'fields under 16px').toEqual([]);
}

/** A tap target is at least 44×44 CSS px (Apple's minimum) */
export async function expectTouchSized(target: Locator): Promise<void> {
	const box = await target.boundingBox();
	expect(box, 'target is laid out').not.toBeNull();
	expect(box!.width, 'target width').toBeGreaterThanOrEqual(44);
	expect(box!.height, 'target height').toBeGreaterThanOrEqual(44);
}

/** The element is wholly inside the viewport horizontally */
export async function expectInsideViewportWidth(page: Page, target: Locator): Promise<void> {
	const box = await target.boundingBox();
	const width = page.viewportSize()!.width;
	expect(box, 'element is laid out').not.toBeNull();
	expect(box!.x, 'left edge').toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width, 'right edge').toBeLessThanOrEqual(width + 0.5);
}

/** A review screenshot named after the device project, e.g. `iphone-se-03-note.png` */
export async function iphoneScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
	// CSS pixels (scale 1), so three devices' images stay small in the repository
	await page.screenshot({ path: path.join(sprintScreenshotDirectory('sprint-047'), `${testInfo.project.name}-${name}.png`), scale: 'css' });
}

export const uniqueSuffix = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
