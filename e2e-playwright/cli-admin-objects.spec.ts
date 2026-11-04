/**
 * Sprint 031-CL: objects the `chronolog` CLI creates (client → contract → deliverable → work
 * type) show up in Settings → Clients and in the workspace sidebar by in-app navigation alone:
 * the page is loaded once, the CLI runs, then only links are clicked (a window marker proves no
 * full reload happened).
 */
import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'cli', 'chronolog.mjs');

function runCli(args: string[], environment: Record<string, string>): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		const child = execFile(process.execPath, [CLI_PATH, ...args, '--json'], { env: { ...process.env, ...environment } }, (error, stdout, stderr) =>
			resolve({ exitCode: error ? Number(error.code ?? 1) : 0, stdout, stderr })
		);
		child.stdin?.end('');
	});
}

test('a client set up through the CLI appears in the admin pages and the sidebar', async ({ page, baseURL }) => {
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
	const shortCode = `C${suffix.slice(-5).toUpperCase()}`;
	const clientName = `CLI Client ${suffix}`;

	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('button', { name: 'Time Entries' })).toBeVisible();
	const rawToken = await page.evaluate(async () => {
		(window as unknown as { loadedOnce: boolean }).loadedOnce = true;
		const response = await fetch('/api/tokens', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'playwright 031' })
		});
		return (await response.json()).rawToken as string;
	});

	const environment = {
		CHRONOLOG_BASE_URL: baseURL!.replace(/\/+$/, ''),
		CHRONOLOG_API_TOKEN: rawToken,
		CHRONOLOG_CONFIG: path.join(mkdtempSync(path.join(tmpdir(), 'chronolog-pw-031-')), 'config.json')
	};
	const steps = [
		['client', 'add', clientName, '--code', shortCode],
		['contract', 'add', shortCode, 'Launch'],
		['deliverable', 'add', `${shortCode}/Launch`, 'Discovery'],
		['work-type', 'add', `${shortCode}/Launch/Discovery`, 'Interviews']
	];
	const created: Array<{ id: string }> = [];
	for (const step of steps) {
		const result = await runCli(step, environment);
		expect(result.exitCode, result.stderr).toBe(0);
		created.push(JSON.parse(result.stdout));
	}
	const contractId = created[1].id;

	// Settings → Clients and contracts → the client → the contract, by clicking links only
	await page.getByTestId('app-sidebar').getByRole('link', { name: 'Settings', exact: true }).click();
	await page.getByRole('link', { name: /Clients and contracts/ }).click();
	await expect(page).toHaveURL(/\/admin\/clients$/);
	await page.getByRole('link', { name: clientName }).click();
	await page.getByRole('link', { name: 'Launch' }).click();
	await expect(page).toHaveURL(new RegExp(`/contracts/${contractId}$`));
	await expect(page.getByText('Discovery').first()).toBeVisible();
	await expect(page.getByText('Interviews', { exact: true })).toBeVisible();

	// Back to the workspace: the sidebar lists the new contract under the new client
	await page.getByRole('link', { name: 'Back to app' }).click();
	const sidebarItem = page.locator(`[data-contract-id="${contractId}"]`).first();
	await expect(sidebarItem).toBeVisible();
	await expect(sidebarItem).toContainText('Launch');
	await expect(page.getByText(clientName).first()).toBeVisible();

	expect(await page.evaluate(() => (window as unknown as { loadedOnce?: boolean }).loadedOnce)).toBe(true);
});
