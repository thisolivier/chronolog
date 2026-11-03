// Sprint 026-CL verification probe. Run from the worktree root:
//   node <this file>
// Uses the worktree's playwright; dev server on 5203.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const WORKTREE = '/Users/olivier/sites/chronolog/.claude/worktrees/sprint-026-CL';
const require = createRequire(WORKTREE + '/package.json');
const { chromium } = require('playwright');

const BASE = 'http://localhost:5203';
const SHOTS = `${WORKTREE}/docs/review/screenshots/sprint-026`;
mkdirSync(SHOTS, { recursive: true });
const runId = Math.random().toString(36).slice(2, 8);
const USER = { name: 'QA 026', email: `qa-026-${runId}@chronolog.test`, password: 'TestPassword123!' };

const results = [];
const pageErrors = [];
const serverErrors = [];
function record(id, ok, detail = '') {
	results.push({ id, ok, detail });
	console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id}${detail ? ' — ' + detail : ''}`);
}
async function step(id, fn) {
	try {
		record(id, true, (await fn()) || '');
	} catch (error) {
		record(id, false, String(error?.message ?? error).split('\n')[0].slice(0, 300));
	}
}
const assert = (condition, message) => {
	if (!condition) throw new Error(message);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('pageerror', (error) => pageErrors.push(`${page.url()} :: ${error.message}`));
page.on('response', (response) => {
	if (response.status() >= 500) serverErrors.push(`${response.request().method()} ${response.url()} -> ${response.status()}`);
});
const shot = (name, target = page) => target.screenshot({ path: `${SHOTS}/${name}.png` });
const api = (path, method = 'GET', body) =>
	page.evaluate(
		async ({ path, method, body }) => {
			const response = await fetch(path, {
				method,
				headers: body ? { 'Content-Type': 'application/json' } : undefined,
				body: body ? JSON.stringify(body) : undefined
			});
			const text = await response.text();
			try {
				return { status: response.status, body: JSON.parse(text) };
			} catch {
				return { status: response.status, body: text };
			}
		},
		{ path, method, body }
	);

// ---------------------------------------------------------------- R1 login race + register
await step('R1-register-disabled-before-hydration', async () => {
	// Delay every script so the page is visible but not hydrated
	await page.route(/\.(js|ts|svelte)(\?.*)?$|\/@vite\/|\/node_modules\//, async (route) => {
		await sleep(1500);
		await route.continue().catch(() => {});
	});
	await page.goto(`${BASE}/register`, { waitUntil: 'commit' });
	await page.waitForSelector('button[type=submit]');
	const disabledEarly = await page.locator('button[type=submit]').isDisabled();
	await page.unroute(/\.(js|ts|svelte)(\?.*)?$|\/@vite\/|\/node_modules\//);
	assert(disabledEarly, 'submit was enabled before hydration');
	return 'submit disabled until hydrated';
});

await step('AUTH-register', async () => {
	await page.goto(`${BASE}/register`);
	await page.waitForFunction(() => !document.querySelector('button[type=submit]')?.hasAttribute('disabled') || true);
	await page.locator('#name').fill(USER.name);
	await page.locator('#email').fill(USER.email);
	await page.locator('#password').fill(USER.password);
	await page.locator('#confirmPassword, #confirm-password').first().fill(USER.password);
	await page.locator('button[type=submit]').click();
	await page.waitForURL(`${BASE}/`, { timeout: 15000 });
	await page.waitForSelector('text=Time Entries');
	return USER.email;
});

await step('R1-login-enter-before-hydration-does-not-native-submit', async () => {
	const loginPage = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
	const pattern = /\.(js|ts|svelte)(\?.*)?$|\/@vite\/|\/node_modules\//;
	await loginPage.route(pattern, async (route) => {
		await sleep(2000);
		await route.continue().catch(() => {});
	});
	await loginPage.goto(`${BASE}/login`, { waitUntil: 'commit' });
	await loginPage.waitForSelector('#password');
	await loginPage.locator('#email').fill(USER.email);
	await loginPage.locator('#password').fill(USER.password);
	await loginPage.locator('#password').press('Enter');
	await sleep(500);
	const urlAfterEnter = loginPage.url();
	await loginPage.unroute(pattern);
	assert(!urlAfterEnter.includes('/login?'), `native GET submit happened: ${urlAfterEnter}`);
	// After hydration the same click signs in
	await loginPage.waitForFunction(() => !document.querySelector('button[type=submit]')?.disabled, null, { timeout: 20000 });
	const emailValue = await loginPage.locator('#email').inputValue();
	if (!emailValue) await loginPage.locator('#email').fill(USER.email);
	if (!(await loginPage.locator('#password').inputValue())) await loginPage.locator('#password').fill(USER.password);
	await loginPage.locator('button[type=submit]').click();
	await loginPage.waitForURL(`${BASE}/`, { timeout: 15000 });
	await loginPage.context().close();
	return `URL after early Enter: ${urlAfterEnter}; signed in after hydration`;
});

// ---------------------------------------------------------------- Settings + admin forms
await step('T5-settings-link-and-page', async () => {
	await page.getByRole('link', { name: 'Settings' }).click();
	await page.waitForURL(`${BASE}/settings`);
	assert((await page.title()) === 'Chronolog · Settings', `title ${await page.title()}`);
	await page.getByRole('link', { name: /Two-factor authentication/ }).waitFor();
	await shot('01-settings-1440');
	await page.getByRole('link', { name: /Clients and contracts/ }).click();
	await page.waitForURL(`${BASE}/admin/clients`);
	const breadcrumbs = await page.locator('nav[aria-label=Breadcrumb]').count();
	assert(breadcrumbs === 1, `${breadcrumbs} breadcrumbs`);
	return 'Settings → Clients, one breadcrumb';
});

async function addClient(name, code) {
	await page.getByRole('button', { name: 'Add Client' }).click();
	await page.locator('#new-client-name').fill(name);
	await page.locator('#new-client-code').fill(code);
	await page.getByRole('button', { name: 'Create Client' }).click();
	await page.getByTestId('admin-success').filter({ hasText: name }).waitFor();
}

await step('T5-add-client-specific-message-and-form-closes', async () => {
	assert((await page.getByRole('button', { name: 'Add Client' }).count()) === 1, 'no Add Client');
	await page.getByRole('button', { name: 'Add Client' }).click();
	assert((await page.getByRole('button', { name: 'Add Client' }).count()) === 0, 'toggle still shown while open');
	await shot('02-add-client-form-open');
	const cancelClass = await page.locator('form').getByRole('button', { name: 'Cancel' }).getAttribute('class');
	assert(!cancelClass.includes('bg-blue-600'), 'Cancel looks primary');
	await page.getByRole('button', { name: 'Cancel' }).click();
	await addClient('Acme Corp', 'ACME');
	const text = await page.getByTestId('admin-success').textContent();
	assert((await page.locator('#new-client-name').count()) === 0, 'form still open');
	return text.trim();
});

await step('T5-duplicate-short-code-error', async () => {
	await page.getByRole('button', { name: 'Add Client' }).click();
	await page.locator('#new-client-name').fill('Acme Again');
	await page.locator('#new-client-code').fill('ACME');
	await page.getByRole('button', { name: 'Create Client' }).click();
	const error = page.getByTestId('admin-error');
	await error.waitFor();
	const text = (await error.textContent()).trim();
	assert(text.includes('ACME') && text.includes('already used'), text);
	assert((await page.locator('#new-client-name').inputValue()) === 'Acme Again', 'typed name lost');
	await shot('03-duplicate-short-code-error');
	await page.keyboard.press('Escape');
	await sleep(200);
	assert((await page.locator('#new-client-name').count()) === 0, 'Escape did not close the add form');
	return text;
});

await step('T5-inline-edit-aligned-and-escape-cancels', async () => {
	await addClient('Globex', 'GLBX');
	const row = page.locator('tr', { has: page.getByRole('link', { name: 'Globex' }) });
	await row.getByRole('button', { name: 'Edit' }).click();
	const nameInput = page.getByLabel('Client name');
	const nameHeader = page.locator('th', { hasText: 'Name' });
	const codeHeader = page.locator('th', { hasText: 'Short Code' });
	const inputBox = await nameInput.boundingBox();
	const codeBox = await page.getByLabel('Short code').boundingBox();
	const nameHeaderBox = await nameHeader.boundingBox();
	const codeHeaderBox = await codeHeader.boundingBox();
	assert(Math.abs(inputBox.x - (nameHeaderBox.x + 24)) < 4, `name input x ${inputBox.x} vs header ${nameHeaderBox.x}`);
	assert(Math.abs(codeBox.x - (codeHeaderBox.x + 24)) < 4, `code input x ${codeBox.x} vs header ${codeHeaderBox.x}`);
	await shot('04-inline-edit-aligned');
	await nameInput.fill('Globex CHANGED');
	await nameInput.press('Escape');
	await sleep(300);
	assert((await page.getByRole('link', { name: 'Globex', exact: true }).count()) === 1, 'Escape saved the edit');
	return `inputs at ${Math.round(inputBox.x)}/${Math.round(codeBox.x)}, Escape cancelled`;
});

// Contracts via the New Contract modal (inline client) and the admin page
await step('T5-new-contract-modal-creates-client-inline', async () => {
	await page.goto(`${BASE}/`);
	await page.getByRole('button', { name: 'New Contract' }).click();
	await page.locator('#client-select').selectOption('__new__');
	await page.locator('#new-client-name').fill('Initech');
	await page.locator('#new-client-code').fill('INIT');
	await page.locator('#contract-name').fill('TPS Reports');
	await shot('05-new-contract-inline-client');
	await page.getByRole('button', { name: 'Create', exact: true }).click();
	await page.getByRole('group', { name: 'Initech' }).getByRole('button', { name: /TPS Reports/ }).waitFor();
	await page.waitForFunction(() => document.title === 'Chronolog · Notes · TPS Reports', null, { timeout: 5000 });
	return 'client + contract created, contract selected, title updated';
});

const clients = (await api('/api/clients')).body.clients;
const acme = clients.find((client) => client.name === 'Acme Corp');
const globex = clients.find((client) => client.name === 'Globex');

await step('SEED-contracts-entries-notes', async () => {
	for (const name of ['Rocket Build', 'Support Retainer', 'Apollo']) {
		await page.goto(`${BASE}/admin/clients/${acme.id}`);
		await page.getByRole('button', { name: 'Add Contract' }).click();
		await page.locator('#new-contract-name').fill(name);
		await page.getByRole('button', { name: 'Create Contract' }).click();
		await page.getByTestId('admin-success').filter({ hasText: name }).waitFor();
	}
	const created = await api('/api/contracts', 'POST', { clientId: globex.id, name: 'Data Audit' });
	assert(created.status === 201, `contract ${created.status}`);
	const contracts = (await api('/api/contracts')).body;
	const rocket = contracts.find((contract) => contract.name === 'Rocket Build');
	const today = new Date().toISOString().slice(0, 10);
	for (const [minutes, description] of [[180, 'Kickoff workshop'], [75, 'Design review'], [30, null]]) {
		const response = await api('/api/time-entries', 'POST', { date: today, durationMinutes: minutes, contractId: rocket.id, description });
		assert(response.status < 300, `entry ${response.status} ${JSON.stringify(response.body)}`);
	}
	for (const title of ['Kickoff notes', 'Risks', 'Interview: CFO']) {
		const response = await api('/api/notes', 'POST', { contractId: rocket.id, title, content: title, contentJson: JSON.stringify({ type: 'doc', content: [] }) });
		assert(response.status < 300, `note ${response.status}`);
	}
	return `Rocket Build ${rocket.id}: 3 entries (4h 45m), 3 notes`;
});

// ---------------------------------------------------------------- Task 4 sidebar
async function sidebarShot(width, name) {
	await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
	await page.goto(`${BASE}/`);
	await page.getByTestId('sidebar-client-group').first().waitFor();
	await sleep(400);
	await shot(name);
}
await step('T4-sidebar-grouped-with-counts-1440', async () => {
	await sidebarShot(1440, '10-sidebar-grouped-1440');
	const groups = await page.getByTestId('sidebar-client-group').evaluateAll((elements) =>
		elements.map((element) => element.getAttribute('aria-label'))
	);
	const acmeContracts = await page.getByRole('group', { name: 'Acme Corp' }).locator('button').allInnerTexts();
	const rocketCount = await page.getByRole('group', { name: 'Acme Corp' }).getByRole('button', { name: /Rocket Build/ }).getByTestId('sidebar-note-count').innerText();
	assert(rocketCount.trim() === '3', `count ${rocketCount}`);
	return `groups ${groups.join(', ')}; Acme: ${acmeContracts.map((text) => text.replace(/\s+/g, ' ').trim()).join(' | ')}`;
});

await step('T4-note-count-stays-correct-after-create', async () => {
	await page.getByRole('group', { name: 'Acme Corp' }).getByRole('button', { name: /Support Retainer/ }).click();
	await page.getByRole('button', { name: /New Note/ }).click();
	const supportButton = page.getByRole('group', { name: 'Acme Corp' }).getByRole('button', { name: /Support Retainer/ });
	await supportButton.getByTestId('sidebar-note-count').filter({ hasText: '1' }).waitFor({ timeout: 5000 });
	return 'Support Retainer count 0 → 1 without reload';
});

// ---------------------------------------------------------------- Task 5 reorder
await step('T5-reorder-contract-arrows-persist-and-sidebar-order', async () => {
	await page.goto(`${BASE}/admin/clients/${acme.id}`);
	const namesBefore = await page.locator('[data-contract-id] a').allInnerTexts();
	await page.getByRole('button', { name: 'Move Support Retainer up' }).click();
	await page.getByTestId('admin-success').filter({ hasText: 'Moved' }).waitFor();
	await page.reload();
	const namesAfter = await page.locator('[data-contract-id] a').allInnerTexts();
	await shot('11-admin-contracts-reordered');
	await page.goto(`${BASE}/`);
	await page.getByTestId('sidebar-client-group').first().waitFor();
	const sidebarOrder = (await page.getByRole('group', { name: 'Acme Corp' }).locator('button').allInnerTexts()).map((text) => text.replace(/\d+$/, '').trim());
	assert(JSON.stringify(sidebarOrder) === JSON.stringify(namesAfter), `sidebar ${sidebarOrder} vs admin ${namesAfter}`);
	assert(JSON.stringify(namesBefore) !== JSON.stringify(namesAfter), 'order unchanged');
	return `${namesBefore.join(',')} → ${namesAfter.join(',')}; sidebar matches`;
});

// ---------------------------------------------------------------- Task 1 safe deletion
const contractsNow = (await api('/api/contracts')).body;
const rocket = contractsNow.find((contract) => contract.name === 'Rocket Build');

await step('T1-delete-dialog-states-counts-archive-default', async () => {
	await page.goto(`${BASE}/admin/clients/${acme.id}`);
	await page.locator(`[data-contract-id="${rocket.id}"]`).getByRole('button', { name: 'Delete' }).click();
	const dialog = page.getByTestId('delete-impact-dialog');
	await dialog.waitFor();
	const counts = (await dialog.getByTestId('delete-impact-counts').innerText()).trim();
	assert(counts === 'It has 3 time entries (4h 45m) and 3 notes.', counts);
	const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
	assert(focused === 'Archive', `focused ${focused}`);
	await shot('20-delete-contract-dialog-1440');
	return `${counts}; default focus: ${focused}`;
});

await step('T1-archive-hides-from-sidebar-and-selects-keeps-data', async () => {
	await page.getByTestId('delete-impact-dialog').getByRole('button', { name: 'Archive' }).click();
	const message = (await page.getByTestId('admin-success').innerText()).trim();
	assert(message.includes('Archived contract'), message);
	await shot('21-after-archive');
	const visible = (await api('/api/contracts')).body.map((contract) => contract.id);
	const sidebar = (await api('/api/contracts-by-client')).body.contracts.map((contract) => contract.id);
	assert(!visible.includes(rocket.id) && !sidebar.includes(rocket.id), 'archived contract still listed');
	return message;
});

await step('T1-restore-then-delete-and-reassign', async () => {
	await page.locator(`[data-contract-id="${rocket.id}"]`).getByRole('button', { name: 'Restore' }).click();
	await page.getByTestId('admin-success').filter({ hasText: 'Restored' }).waitFor();
	await page.locator(`[data-contract-id="${rocket.id}"]`).getByRole('button', { name: 'Delete' }).click();
	await page.getByTestId('delete-impact-dialog').getByRole('button', { name: 'Delete and reassign' }).click();
	const message = page.getByTestId('admin-success').filter({ hasText: 'Deleted' });
	await message.waitFor();
	await shot('22-after-delete-and-reassign');
	return (await message.innerText()).trim();
});

await step('T1-entries-and-notes-survive-under-deleted-contract', async () => {
	await page.goto(`${BASE}/`);
	await page.getByText('Formerly: Acme Corp / Rocket Build').first().waitFor({ timeout: 8000 });
	const formerlyCount = await page.getByText('Formerly: Acme Corp / Rocket Build').count();
	await shot('23-timesheet-entries-kept-formerly');
	const notesSearch = await api('/api/notes/search?q=Risks');
	return `${formerlyCount} cards show the Formerly line; note search status ${notesSearch.status} hits ${JSON.stringify(notesSearch.body).includes('Risks')}`;
});

await step('T1-deleted-client-not-listed', async () => {
	const names = (await api('/api/clients')).body.clients.map((client) => client.name);
	assert(!names.includes('Deleted Client'), names.join(','));
	await page.goto(`${BASE}/admin/clients`);
	assert((await page.getByText('Deleted Client').count()) === 0, 'Deleted Client shown in admin');
	return names.join(', ');
});

await step('T1-deliverable-delete-confirm-with-count', async () => {
	const apollo = (await api('/api/contracts')).body.find((contract) => contract.name === 'Apollo');
	await page.goto(`${BASE}/admin/clients/${acme.id}/contracts/${apollo.id}`);
	await page.getByRole('button', { name: 'Add Deliverable' }).click();
	await page.locator('#new-deliverable-name').fill('Phase 1 - Discovery');
	await page.getByRole('button', { name: 'Create Deliverable' }).click();
	await page.getByTestId('admin-success').filter({ hasText: 'Phase 1' }).waitFor();
	const deliverables = (await api(`/api/deliverables?contractId=${apollo.id}`)).body;
	const today = new Date().toISOString().slice(0, 10);
	for (const minutes of [60, 45]) {
		await api('/api/time-entries', 'POST', { date: today, durationMinutes: minutes, contractId: apollo.id, deliverableId: deliverables[0].id, description: 'Discovery call' });
	}
	await page.reload();
	await page.getByRole('button', { name: 'Delete' }).first().click();
	const dialog = page.getByTestId('delete-impact-dialog');
	const counts = (await dialog.getByTestId('delete-impact-counts').innerText()).trim();
	assert(counts === 'It has 2 time entries (1h 45m).', counts);
	await shot('24-delete-deliverable-dialog');
	await dialog.getByRole('button', { name: 'Delete, keep a note on entries' }).click();
	const message = (await page.getByTestId('admin-success').innerText()).trim();
	assert(message.includes('2 time entries keep'), message);
	return `${counts} → ${message}`;
});

// ---------------------------------------------------------------- Task 6 titles, 404, malformed IDs
await step('T6-titles-404-and-malformed-admin-id', async () => {
	const titles = {};
	for (const path of ['/', '/admin/clients', `/admin/clients/${acme.id}`, '/settings/two-factor', '/settings']) {
		await page.goto(`${BASE}${path}`);
		await sleep(300);
		titles[path] = await page.title();
	}
	const missing = await page.goto(`${BASE}/nope`);
	await page.getByTestId('error-page').waitFor();
	await shot('30-friendly-404');
	const malformed = await page.goto(`${BASE}/admin/clients/not-a-uuid`);
	const malformedContract = await page.goto(`${BASE}/admin/clients/${acme.id}/contracts/123`);
	assert(missing.status() === 404 && malformed.status() === 404 && malformedContract.status() === 404, `${missing.status()} ${malformed.status()} ${malformedContract.status()}`);
	assert(Object.values(titles).every((title) => title.startsWith('Chronolog')), JSON.stringify(titles));
	return `404/404/404; ${JSON.stringify(titles)}`;
});

// ---------------------------------------------------------------- Task 3 breakpoints
await step('T3-layouts-1440-900-390', async () => {
	const report = [];
	for (const width of [1440, 900, 390]) {
		await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
		await page.goto(`${BASE}/`);
		await page.getByText('Time Entries').first().waitFor();
		await sleep(500);
		const hasBack = width === 390;
		if (width === 390) {
			await shot(`40-home-${width}`);
			await page.getByRole('group', { name: 'Acme Corp' }).getByRole('button', { name: /Support Retainer/ }).click();
			await sleep(400);
			const backVisible = await page.getByRole('button', { name: /Back/ }).isVisible();
			assert(backVisible, 'no Back at 390');
			await shot(`41-notes-list-${width}`);
			report.push(`${width}: drill-down`);
			continue;
		}
		await shot(`40-time-mode-${width}`);
		await page.getByRole('group', { name: 'Acme Corp' }).getByRole('button', { name: /Support Retainer/ }).click();
		await sleep(500);
		const sidebarWidth = (await page.getByTestId('app-sidebar').boundingBox()).width;
		const backCount = await page.getByRole('button', { name: /Back/ }).count();
		assert(backCount === 0, `mobile Back bar at ${width}`);
		await shot(`41-notes-mode-${width}`);
		if (width === 900) {
			assert(sidebarWidth === 0, `sidebar ${sidebarWidth} in tablet notes mode`);
			await page.getByRole('button', { name: 'Toggle sidebar' }).click();
			await sleep(400);
			const overlayWidth = (await page.getByTestId('app-sidebar').boundingBox()).width;
			assert(overlayWidth === 240, `overlay ${overlayWidth}`);
			await shot('42-tablet-sidebar-overlay-900');
			await page.getByRole('group', { name: 'Globex' }).getByRole('button', { name: /Data Audit/ }).click();
			await sleep(400);
			assert((await page.getByTestId('app-sidebar').boundingBox()).width === 0, 'overlay did not close');
		} else {
			assert(sidebarWidth === 240, `sidebar ${sidebarWidth} at 1440`);
		}
		report.push(`${width}: sidebar ${sidebarWidth}px, no Back bar`);
	}
	await page.setViewportSize({ width: 1440, height: 900 });
	return report.join('; ');
});

// ---------------------------------------------------------------- Task 2 offline
await step('T2-offline-banner-timesheet-keeps-data', async () => {
	for (const width of [1440, 900, 390]) {
		await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
		await page.goto(`${BASE}/`);
		if (width === 390) {
			await page.getByRole('button', { name: 'Time Entries' }).click();
		}
		await page.getByText('Discovery call').first().waitFor({ timeout: 8000 });
		await context.setOffline(true);
		const banner = page.getByTestId('connection-status-offline');
		await banner.waitFor({ timeout: 5000 });
		const text = (await banner.innerText()).trim();
		assert(text.startsWith('Offline, showing last loaded data'), text);
		// Switch away and back: the week is re-requested and served from the last loaded copy
		await page.getByRole('button', { name: /Data Audit/ }).first().click().catch(() => {});
		if (width === 390) await page.getByRole('button', { name: /Back/ }).click();
		await page.getByRole('button', { name: 'Time Entries' }).click();
		await sleep(800);
		const stillThere = await page.getByText('Discovery call').count();
		assert(stillThere > 0, `entries gone offline at ${width}`);
		await shot(`50-offline-timesheet-${width}`);
		await context.setOffline(false);
		await page.getByTestId('connection-status-online').waitFor({ timeout: 5000 });
	}
	await page.setViewportSize({ width: 1440, height: 900 });
	return 'banner shown via setOffline at 1440/900/390; entries still shown';
});

await step('T2-offline-banner-notes-mode', async () => {
	await page.goto(`${BASE}/`);
	await page.getByRole('group', { name: 'Acme Corp' }).getByRole('button', { name: /Support Retainer/ }).click();
	await sleep(500);
	await context.setOffline(true);
	const banner = page.getByTestId('connection-status-offline');
	await banner.waitFor({ timeout: 5000 });
	const text = (await banner.innerText()).trim();
	assert(text.startsWith('Offline, changes not saved'), text);
	await shot('51-offline-notes-1440');
	await context.setOffline(false);
	return text;
});

await step('T3-settings-and-admin-390', async () => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`${BASE}/admin/clients/${acme.id}`);
	await shot('60-admin-client-390');
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
	await page.locator('[data-contract-id] button', { hasText: 'Delete' }).first().click();
	await shot('61-delete-dialog-390');
	await page.keyboard.press('Escape');
	await page.setViewportSize({ width: 900, height: 900 });
	await page.goto(`${BASE}/admin/clients`);
	await shot('62-admin-clients-900');
	await page.setViewportSize({ width: 1440, height: 900 });
	return `horizontal overflow at 390: ${overflow}px`;
});

console.log('\npage errors:', pageErrors.length ? pageErrors : 'none');
console.log('5xx responses:', serverErrors.length ? serverErrors : 'none');
writeFileSync(new URL('./probe-results.json', import.meta.url), JSON.stringify({ user: USER.email, results, pageErrors, serverErrors }, null, 2));
await browser.close();
const failed = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
