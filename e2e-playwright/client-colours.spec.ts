/**
 * Sprint 044-CL: distinct client colours. On its own user (a fresh one, so the palette is known):
 * Internal is Rose (0). Two clients made through the API with the same colour show the hint in
 * Settings → Clients; the New client form suggests the first colour no active client uses, and a
 * client created with it gets that colour. Archiving one of the pair makes the hint go away.
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { signInAsFreshUser } from './fresh-user';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-044');

async function createClient(page: Page, name: string, shortCode: string, colorIndex?: number) {
	return page.evaluate(
		async (body) => {
			const response = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
			if (!response.ok) throw new Error(`create ${response.status} ${await response.text()}`);
			return (await response.json()).client as { id: string; colorIndex: number };
		},
		{ name, shortCode, ...(colorIndex === undefined ? {} : { colorIndex }) }
	);
}

test('shared colours are hinted; a new client gets the first unused colour', async ({ page, baseURL, browserName }) => {
	await signInAsFreshUser(page, baseURL, 'colours');
	// Let the app settle on / first: it may still be writing its own history entry there
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
	const suffix = Date.now().toString(36).slice(-4).toUpperCase();

	// Sky (1) is taken twice; Rose (0) by Internal
	await createClient(page, 'Aspen Ltd', `ASP${suffix}`, 1);
	const birch = await createClient(page, 'Birch Co', `BIR${suffix}`, 1);

	await page.goto('/admin/clients');
	await page.waitForLoadState('networkidle');
	const hint = page.getByTestId('shared-colour-hint');
	await expect(hint).toContainText('Aspen Ltd and Birch Co share Sky.');

	// The form suggests Violet (2): Rose and Sky are in use
	await page.getByRole('button', { name: 'Add Client' }).click();
	await expect(page.locator('#new-client-color')).toHaveValue('2');
	if (browserName === 'chromium') await page.screenshot({ path: path.join(SCREENSHOTS, '03-shared-colour-hint.png'), fullPage: true });
	await page.locator('#new-client-name').fill('Cedar Inc');
	await page.locator('#new-client-code').fill(`CED${suffix}`);
	await page.getByRole('button', { name: 'Create Client' }).click();
	await expect(page.getByText('Client “Cedar Inc” created.')).toBeVisible();
	const listed = await page.evaluate(async () => (await (await fetch('/api/clients')).json()).clients as Array<{ name: string; colorIndex: number }>);
	expect(listed.find((client) => client.name === 'Cedar Inc')?.colorIndex).toBe(2);

	// Through the API without a colour: the next unused one (Amber, 3)
	expect((await createClient(page, 'Dogwood', `DOG${suffix}`)).colorIndex).toBe(3);

	// Archive Birch: the hint goes
	await page.evaluate(async (clientId) => {
		await fetch(`/api/clients/${clientId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: true }) });
	}, birch.id);
	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
	await expect(hint).toHaveCount(0);
});
