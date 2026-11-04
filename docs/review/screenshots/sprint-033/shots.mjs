/**
 * Sprint 033-CL screenshots: a fresh `qa-033-shots-*` user with multi-contract, single-contract and
 * archived clients, then the sidebar at 1280 px and 390 px.
 * Run: QA_BASE_URL=http://localhost:5211 node docs/review/screenshots/sprint-033/shots.mjs
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.QA_BASE_URL ?? 'http://localhost:5211';
const SHOTS = path.dirname(fileURLToPath(import.meta.url));
const email = `qa-033-shots-${Date.now()}@chronolog.test`;
const password = 'TestPassword123!';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

await page.goto(`${BASE}/register`);
await page.waitForLoadState('networkidle');
await page.locator('#name').fill('QA 033');
await page.locator('#email').fill(email);
await page.locator('#password').fill(password);
await page.locator('#confirm-password').fill(password);
await page.locator('button[type="submit"]').click();
await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 });
await page.waitForLoadState('networkidle');

const seeded = await page.evaluate(async () => {
	const send = async (method, url, body) => {
		const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
		if (!response.ok) throw new Error(`${method} ${url} ${response.status} ${await response.text()}`);
		return response.json();
	};
	const client = async (name, shortCode, colorIndex) => (await send('POST', '/api/clients', { name, shortCode, colorIndex })).client.id;
	const contract = async (clientId, name) => (await send('POST', '/api/contracts', { clientId, name, isActive: true })).id;
	const note = async (contractId, title) => (await send('POST', '/api/notes', { contractId, title, content: `${title}\n\nNotes from the session.` })).note.id;

	const acme = await client('Acme Corp', 'ACME', 0);
	await contract(acme, 'Rocket Build');
	await contract(acme, 'Launch Ops');
	const testStand = await contract(acme, 'Test Stand');
	const borealis = await client('Borealis Labs', 'BORL', 1);
	const dataPlatform = await contract(borealis, 'Data Platform');
	const cobalt = await client('Cobalt & Sons', 'COBA', 4);
	await contract(cobalt, 'Brand Refresh');
	const northwind = await client('Northwind Traders', 'NWT', 3);
	const warehouseAudit = await contract(northwind, 'Warehouse Audit');
	await contract(northwind, 'Supply Review');

	const dataNote = await note(dataPlatform, 'Schema review');
	const auditNote = await note(warehouseAudit, 'Audit findings');
	const today = new Date();
	const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	await send('POST', '/api/time-entries', { date, durationMinutes: 45, contractId: dataPlatform, description: `Compared with the audit [[${auditNote}]]` });

	await send('PATCH', `/api/contracts/${testStand}`, { archived: true });
	await send('PATCH', `/api/clients/${northwind}`, { archived: true });
	return { dataPlatform, dataNote, warehouseAudit, auditNote };
});

const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const sidebar = page.getByTestId('app-sidebar');

// Desktop: Archived collapsed, then expanded
await page.goto(`${BASE}/`);
await page.waitForLoadState('networkidle');
await sidebar.getByTestId('sidebar-archived-toggle').waitFor();
await shot('01-desktop-archived-collapsed');
await sidebar.getByTestId('sidebar-archived-toggle').click();
await page.mouse.move(900, 400);
await page.waitForTimeout(300);
await shot('02-desktop-archived-expanded');
await sidebar.getByTestId('sidebar-archived-toggle').click();

// Single-contract client, landed on by URL
await page.goto(`${BASE}/notes/${seeded.dataPlatform}/${seeded.dataNote}`);
await page.waitForLoadState('networkidle');
await page.locator(`[data-contract-id="${seeded.dataPlatform}"][aria-current="page"]`).waitFor();
await shot('03-desktop-single-contract-selected');

// Archived contract, opened from a timesheet card's wiki-link
await page.goto(`${BASE}/time`);
await page.waitForLoadState('networkidle');
await page.getByTitle(seeded.auditNote).first().click();
await page.waitForURL(`**/notes/${seeded.warehouseAudit}/${seeded.auditNote}`);
await page.locator(`[data-contract-id="${seeded.warehouseAudit}"][aria-current="page"]`).waitFor();
await page.waitForTimeout(400);
await shot('04-desktop-archived-contract-selected');

// Phone: the sidebar is the home screen
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => localStorage.removeItem('chronolog:sidebar-archived-expanded'));
await page.goto(`${BASE}/`);
await page.waitForLoadState('networkidle');
await sidebar.getByTestId('sidebar-archived-toggle').waitFor().catch(() => {});
await shot('05-phone-archived-collapsed');
await page.getByTestId('sidebar-archived-toggle').first().click();
await page.waitForTimeout(300);
await shot('06-phone-archived-expanded');
await page.goto(`${BASE}/notes/${seeded.dataPlatform}`);
await page.waitForLoadState('networkidle');
await shot('07-phone-single-contract-list');

console.log(JSON.stringify({ email, seeded, pageErrors }, null, 2));
await browser.close();
