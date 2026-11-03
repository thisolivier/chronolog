// Sprint-018 checklist driver (sections A, C, E) — headless Chromium via Playwright library.
// Run from the repo root: node e2e-playwright/manual-checklist/qa-driver.mjs   (see README.md alongside)
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

const BASE = process.env.QA_BASE_URL ?? 'http://localhost:5173';
const SHOTS = process.env.QA_SHOTS_DIR ?? resolve(REPO_ROOT, 'test-results/manual-checklist/screenshots');
const OUT = process.env.QA_RESULTS ?? resolve(REPO_ROOT, 'test-results/manual-checklist/qa-results.json');
mkdirSync(SHOTS, { recursive: true });
mkdirSync(dirname(OUT), { recursive: true });

const runId = Date.now().toString(36);
const USER = { name: 'QA Nov', email: `qa-20261103-${runId}@chronolog.test`, password: 'TestPassword123!' };

const results = [];
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const navigations = [];

function record(id, status, reason = '') {
	results.push({ id, status, reason });
	console.log(`[${status}] ${id} ${reason ? '— ' + reason : ''}`);
}
async function step(id, fn) {
	try {
		const reason = await fn();
		record(id, 'PASS', reason || '');
	} catch (error) {
		record(id, 'FAIL', (error && error.message ? error.message : String(error)).split('\n')[0].slice(0, 300));
	}
}
function assert(condition, message) {
	if (!condition) throw new Error(message);
}
async function selectByText(selectLocator, text) {
	const value = await selectLocator.evaluate((element, wanted) => {
		const option = Array.from(element.options).find((candidate) => candidate.textContent.includes(wanted));
		return option ? option.value : null;
	}, text);
	if (!value) throw new Error(`no <option> containing "${text}"`);
	await selectLocator.selectOption(value);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const today = new Date();
const pad = (n) => String(n).padStart(2, '0');
const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
const todayHeader = new Date(todayIso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
page.on('console', (message) => {
	if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(`[${message.type()}] ${page.url()} :: ${message.text().slice(0, 400)}`);
});
page.on('pageerror', (error) => pageErrors.push(`${page.url()} :: ${error.message.slice(0, 400)}`));
page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText}`));
page.on('response', (response) => { if (response.status() >= 400) failedRequests.push(`${response.request().method()} ${response.url()} -> ${response.status()}`); });
page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations.push(frame.url()); });

const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

// ---------------------------------------------------------------- AUTH
await step('AUTH-redirect-unauthenticated', async () => {
	const response = await page.goto(BASE + '/');
	await page.waitForURL('**/login', { timeout: 15000 });
	return `GET / -> ${page.url()} (status ${response?.status()})`;
});

await step('AUTH-register', async () => {
	await page.goto(BASE + '/register');
	// Wait for hydration so the Svelte onsubmit handler is attached (see hydration race finding)
	await page.waitForLoadState('networkidle');
	await page.locator('#name').fill(USER.name);
	await page.locator('#email').fill(USER.email);
	await page.locator('#password').fill(USER.password);
	await page.locator('#confirm-password').fill(USER.password);
	const started = Date.now();
	await page.locator('button[type="submit"]').click();
	await page.waitForURL('**/login', { timeout: 15000 });
	return `registered ${USER.email}, redirected to /login in ${Date.now() - started}ms`;
});

await step('AUTH-login-redirect', async () => {
	await page.waitForLoadState('networkidle');
	await page.locator('#email').fill(USER.email);
	await page.locator('#password').fill(USER.password);
	const started = Date.now();
	await page.locator('button[type="submit"]').click();
	await page.waitForURL((url) => url.pathname === '/', { timeout: 20000 });
	await page.getByRole('button', { name: 'Time Entries' }).waitFor({ timeout: 15000 });
	await shot('01-after-login');
	return `landed on ${page.url()} in ${Date.now() - started}ms; navigations: ${navigations.slice(-3).join(' , ')}`;
});

await step('AUTH-login-page-when-authenticated', async () => {
	await page.goto(BASE + '/login');
	await sleep(1000);
	return `visiting /login while authenticated stays at ${page.url()} (no redirect to /)`;
});

// Native-submit race probe: submit the login form BEFORE hydration completes.
await step('AUTH-native-submit-race', async () => {
	const probePage = await context.newPage();
	await probePage.route('**/_app/**', async (route) => { await sleep(1500); await route.continue(); }); // slow down hydration
	await probePage.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
	await probePage.locator('#email').fill(USER.email);
	await probePage.locator('#password').fill(USER.password);
	await probePage.locator('button[type="submit"]').click();
	await sleep(3000);
	const url = probePage.url();
	await probePage.close();
	if (url.includes('?')) throw new Error(`form did native GET submit to ${url} (no preventDefault / pre-hydration click)`);
	return `url after pre-hydration submit: ${url}`;
});

await page.goto(BASE + '/');
await page.getByRole('button', { name: 'Time Entries' }).waitFor();
await page.waitForLoadState('networkidle');

// ---------------------------------------------------------------- A1 palette
await step('A1-palette-stone', async () => {
	const bodyBg = await page.evaluate(() => getComputedStyle(document.querySelector('.bg-stone-50')).backgroundColor);
	const html = await page.content();
	const grayCount = (html.match(/\b(bg|text|border)-gray-/g) || []).length;
	const stoneCount = (html.match(/\b(bg|text|border)-stone-/g) || []).length;
	assert(stoneCount > 10, 'no stone classes found');
	return `stone-50 bg = ${bodyBg}; stone classes=${stoneCount}, gray classes=${grayCount}`;
});
await step('A1-interactive-blue-600', async () => {
	const html = await page.content();
	const blue600 = (html.match(/\b(bg|text)-blue-600\b/g) || []).length;
	const blueOther = (html.match(/\b(bg|text)-blue-(500|700)\b/g) || []).length;
	return `time mode: blue-600 classes=${blue600}, blue-500/700=${blueOther} (links use blue-500/700; New Note / Save buttons use bg-blue-600)`;
});

// ---------------------------------------------------------------- A2 layout
await step('A2-time-mode-two-panels', async () => {
	const panels = await page.evaluate(() => {
		const row = document.querySelector('.flex.flex-1.overflow-hidden');
		return Array.from(row.children).map((child) => ({ width: child.getBoundingClientRect().width, hasResize: !!child.querySelector('[aria-label="Resize panel"]') }));
	});
	assert(panels.length === 2, `expected 2 panels, got ${panels.length}: ${JSON.stringify(panels)}`);
	return `panels: ${JSON.stringify(panels)}`;
});
await step('A3-weekstrip-present', async () => {
	const strip = page.locator('.sticky.top-0');
	await strip.first().waitFor({ timeout: 10000 });
	const text = await strip.first().innerText();
	assert(/Week \d+/.test(text), 'no Week N label: ' + text);
	const days = await strip.first().locator('.grid-cols-7 > button').count();
	assert(days === 7, `expected 7 day columns, got ${days}`);
	const labels = await strip.first().locator('.grid-cols-7 > button span:first-child').allInnerTexts();
	assert(labels.join(',') === 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 'day labels: ' + labels.join(','));
	await shot('02-time-entries-mode');
	return `WeekStrip: ${text.replace(/\s+/g, ' ').slice(0, 120)}`;
});
await step('A3-today-column-amber', async () => {
	const todayButton = page.locator('.sticky.top-0 .grid-cols-7 > button.bg-amber-100');
	assert((await todayButton.count()) === 1, 'no amber-highlighted today column');
	const dayNumber = await todayButton.locator('span').nth(1).innerText();
	assert(Number(dayNumber) === today.getDate(), `highlighted day ${dayNumber} != today ${today.getDate()}`);
	return `today column ${dayNumber} highlighted`;
});
await step('A6-today-badge-and-bg', async () => {
	const badge = page.getByText('Today', { exact: true });
	await badge.first().waitFor({ timeout: 10000 });
	const section = page.locator('div.bg-amber-50\\/60');
	assert((await section.count()) >= 1, 'no amber today section');
	const header = await section.first().locator('h2').innerText();
	assert(header === todayHeader, `today header "${header}" != "${todayHeader}"`);
	return `today section header "${header}" with TODAY badge`;
});
await step('A6-autoscroll-to-today', async () => {
	await page.reload();
	await page.getByText('Today', { exact: true }).first().waitFor({ timeout: 10000 });
	await sleep(1200);
	const box = await page.locator('div.bg-amber-50\\/60').first().boundingBox();
	assert(box && box.y >= 0 && box.y < 900, `today section at y=${box?.y}`);
	return `today section visible at y=${Math.round(box.y)} after reload`;
});
await step('A8-empty-state', async () => {
	const empties = page.locator('.border-dashed');
	const count = await empties.count();
	assert(count > 0, 'no dashed empty-state containers');
	const text = await empties.first().innerText();
	assert(text.includes('No entries') && text.includes('Add'), 'empty text: ' + text);
	return `${count} empty days with "No entries" + "+ Add"`;
});
await step('A2-sidebar-collapse-expand', async () => {
	const sidebar = page.locator('.flex.flex-1.overflow-hidden > div').first();
	const before = (await sidebar.boundingBox()).width;
	await page.getByRole('button', { name: 'Toggle sidebar' }).click();
	await sleep(500);
	const collapsed = (await sidebar.boundingBox()).width;
	await shot('03-sidebar-collapsed');
	await page.getByRole('button', { name: 'Toggle sidebar' }).click();
	await sleep(500);
	const after = (await sidebar.boundingBox()).width;
	assert(before === 240 && collapsed <= 1 && after === 240, `widths ${before}/${collapsed}/${after}`);
	return `sidebar 240 -> ${collapsed} (1px = remaining border-r) -> 240`;
});

// ---------------------------------------------------------------- Admin: second client + contract (needed for colours and move)
await step('E1-admin-create-client', async () => {
	await page.goto(BASE + '/admin/clients');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Add Client' }).click();
	await page.locator('#new-client-name').fill('Acme Corp');
	await page.locator('#new-client-code').fill('ACME');
	await page.locator('form[action="?/create"] button[type="submit"]').click();
	await page.getByText('Acme Corp').first().waitFor({ timeout: 10000 });
	await shot('04-admin-clients');
	return 'client "Acme Corp" (ACME) created via /admin/clients';
});
let acmeClientUrl = '';
await step('E1-admin-create-contract', async () => {
	const link = page.locator('a[href^="/admin/clients/"]').filter({ hasText: 'Acme Corp' }).first();
	if ((await link.count()) === 0) {
		// fall back: any link/button for the client row
		const row = page.getByText('Acme Corp').first();
		await row.click();
	} else {
		await link.click();
	}
	await page.waitForURL('**/admin/clients/*', { timeout: 10000 });
	acmeClientUrl = page.url();
	await page.waitForLoadState('networkidle');
	// open create contract form (may be behind a button)
	await page.getByRole('button', { name: 'Add Contract' }).click();
	await page.locator('form[action="?/createContract"] input[name="name"]').fill('Rocket Build');
	await page.locator('form[action="?/createContract"] button[type="submit"]').click();
	await page.getByText('Rocket Build').first().waitFor({ timeout: 10000 });
	await shot('05-admin-client-contract');
	return `contract "Rocket Build" created at ${acmeClientUrl}`;
});
await step('E1-admin-create-deliverable', async () => {
	const contractLink = page.locator('a[href*="/contracts/"]').filter({ hasText: 'Rocket Build' }).first();
	await contractLink.click();
	await page.waitForURL('**/contracts/*', { timeout: 10000 });
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Add Deliverable' }).click();
	await page.locator('form[action*="createDeliverable"] input[name="name"]').fill('Phase 1');
	await page.locator('form[action*="createDeliverable"] button[type="submit"]').click();
	await page.getByText('Phase 1').first().waitFor({ timeout: 10000 });
	return 'deliverable "Phase 1" created under Rocket Build';
});

// ---------------------------------------------------------------- Back to app; A10 client colours in sidebar
await page.goto(BASE + '/');
await page.getByRole('button', { name: 'Time Entries' }).waitFor();
await page.waitForLoadState('networkidle');
let sidebarDots = {};
await step('A10-sidebar-color-dots', async () => {
	await page.getByRole('button', { name: /Rocket Build/ }).waitFor({ timeout: 10000 });
	const contractButtons = page.locator('button:has(span.rounded-full.h-2)');
	const count = await contractButtons.count();
	for (let index = 0; index < count; index++) {
		const button = contractButtons.nth(index);
		const name = (await button.innerText()).trim();
		const dotClass = await button.locator('span.rounded-full').first().getAttribute('class');
		sidebarDots[name] = (dotClass.match(/bg-[a-z]+-\d+/) || [])[0];
	}
	const colors = Object.values(sidebarDots);
	assert(colors.length >= 2, 'fewer than 2 contracts: ' + JSON.stringify(sidebarDots));
	assert(new Set(colors).size === colors.length, 'colours not distinct: ' + JSON.stringify(sidebarDots));
	return JSON.stringify(sidebarDots);
});

// ---------------------------------------------------------------- Notes first (so wiki-link autocomplete has targets)
let noteAId = '', noteBId = '';
await step('E1-create-note', async () => {
	await page.getByRole('button', { name: /General/ }).click();
	await page.getByRole('button', { name: 'New Note' }).waitFor({ timeout: 10000 });
	await page.getByRole('button', { name: 'New Note' }).click();
	const idSpan = page.locator('span.font-mono.text-stone-400');
	await idSpan.first().waitFor({ timeout: 10000 });
	noteAId = (await idSpan.first().innerText()).trim();
	assert(/^[A-Z]+\.\d{8}\.\d{3}$/.test(noteAId), 'unexpected note id ' + noteAId);
	await page.locator('.tiptap').waitFor({ timeout: 10000 });
	return `created ${noteAId}`;
});
await step('A2-notes-mode-three-panels', async () => {
	const panels = await page.evaluate(() => Array.from(document.querySelector('.flex.flex-1.overflow-hidden').children).map((child) => Math.round(child.getBoundingClientRect().width)));
	assert(panels.length === 3, `expected 3 panels, got ${JSON.stringify(panels)}`);
	await shot('06-notes-mode');
	return `panel widths ${JSON.stringify(panels)}`;
});
await step('E1-edit-note-tiptap-autosave', async () => {
	const editor = page.locator('.tiptap');
	await editor.click();
	await page.keyboard.type('Alpha note heading');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Body text for **alpha** note with a list:');
	await page.keyboard.press('Enter');
	await page.keyboard.type('- item one');
	const saveResponse = page.waitForResponse((response) => response.url().includes(`/api/notes/${noteAId}`) && response.request().method() === 'PUT', { timeout: 10000 });
	await saveResponse;
	await sleep(800);
	await page.reload();
	await page.getByRole('button', { name: 'Time Entries' }).waitFor({ timeout: 10000 });
	await sleep(500);
	const modeAfterReload = (await page.locator('.tiptap').count()) ? 'notes (selection kept)' : 'time-entries (selection lost)';
	// After reload, navigation state is in-memory only — re-open the note via sidebar
	await page.getByRole('button', { name: /General/ }).click();
	await page.getByRole('button', { name: /Alpha note heading/ }).first().click();
	await page.locator('.tiptap').waitFor({ timeout: 10000 });
	const text = await page.locator('.tiptap').innerText();
	assert(text.includes('Alpha note heading') && text.includes('item one'), 'content after reload: ' + text.slice(0, 100));
	const listItems = await page.locator('.tiptap li').count();
	const preview = await page.locator('button:has-text("Alpha note heading")').first().innerText();
	return `after reload app opened in ${modeAfterReload}; content persisted (${listItems} list item(s)); list preview: "${preview.replace(/\s+/g, ' ').slice(0, 60)}"`;
});
await step('E1-raw-rendered-toggle', async () => {
	const toggle = page.getByTitle('Toggle raw markdown view');
	await toggle.click();
	const textarea = page.locator('textarea[placeholder="Write markdown here..."]');
	await textarea.waitFor({ timeout: 5000 });
	const raw = await textarea.inputValue();
	assert(raw.includes('Alpha note heading') && raw.includes('- item one'), 'raw markdown: ' + raw.slice(0, 120));
	await shot('07-raw-mode');
	await textarea.fill(raw + '\n\n## Added in raw mode\n');
	await page.waitForResponse((response) => response.url().includes(`/api/notes/${noteAId}`) && response.request().method() === 'PUT', { timeout: 10000 });
	await toggle.click();
	await page.locator('.tiptap').waitFor({ timeout: 5000 });
	const h2 = await page.locator('.tiptap h2').allInnerTexts();
	assert(h2.includes('Added in raw mode'), 'rendered h2s: ' + h2.join('|'));
	return `raw markdown: ${raw.replace(/\n/g, '\\n').slice(0, 80)}...; raw edit rendered as h2`;
});
await step('E1-export-markdown', async () => {
	await page.getByRole('button', { name: /Export/ }).click();
	const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
	await page.getByRole('button', { name: 'Export as Markdown' }).click();
	const download = await downloadPromise;
	const path = await download.path();
	const content = (await import('node:fs')).readFileSync(path, 'utf8');
	assert(content.includes('Alpha note heading'), 'md content: ' + content.slice(0, 100));
	return `downloaded "${download.suggestedFilename()}" (${content.length} bytes)`;
});
await step('E1-export-pdf-print', async () => {
	await page.evaluate(() => { window.__printCalled = 0; window.print = () => { window.__printCalled++; }; });
	await page.getByRole('button', { name: /Export/ }).click();
	await page.getByRole('button', { name: 'Export as PDF' }).click();
	const called = await page.evaluate(() => window.__printCalled);
	assert(called === 1, 'window.print not called');
	const printRules = await page.evaluate(() => Array.from(document.styleSheets).some((sheet) => { try { return Array.from(sheet.cssRules).some((rule) => rule.media && rule.media.mediaText.includes('print')); } catch { return false; } }));
	await page.emulateMedia({ media: 'print' });
	await shot('08-print-media-emulated');
	await page.emulateMedia({ media: null });
	return `window.print() invoked; @media print rules loaded=${printRules} (dialog itself not verifiable headless)`;
});

// second note + wiki link in editor
await step('E1-wiki-link-editor-autocomplete', async () => {
	await page.getByRole('button', { name: 'New Note' }).click();
	await sleep(500);
	const idSpan = page.locator('span.font-mono.text-stone-400').first();
	noteBId = (await idSpan.innerText()).trim();
	assert(noteBId !== noteAId, 'note B id same as A');
	const editor = page.locator('.tiptap');
	await editor.click();
	await page.keyboard.type('Beta note links to ');
	await page.keyboard.type('[[');
	await page.keyboard.type(noteAId.slice(0, 6), { delay: 50 });
	const dropdown = page.locator('body > div.absolute.z-50');
	await dropdown.waitFor({ timeout: 8000 });
	const items = await dropdown.innerText();
	assert(items.includes(noteAId), 'dropdown items: ' + items);
	await shot('09-wiki-link-autocomplete');
	await page.keyboard.press('Enter');
	await sleep(300);
	const link = page.locator('.tiptap .wiki-link');
	assert((await link.count()) === 1, 'no wiki-link node inserted');
	await page.waitForResponse((response) => response.url().includes(`/api/notes/${noteBId}`) && response.request().method() === 'PUT', { timeout: 10000 });
	return `B=${noteBId} got wiki-link to ${noteAId}; dropdown showed: ${items.replace(/\s+/g, ' ').slice(0, 80)}`;
});
await step('E1-backlinks-displayed', async () => {
	await page.getByRole('button', { name: /Alpha note heading/ }).first().click();
	await page.locator('.tiptap').waitFor();
	const linkedFrom = page.getByText('Linked from');
	await linkedFrom.waitFor({ timeout: 8000 });
	const backlinkButton = page.locator('button.font-mono', { hasText: noteBId });
	assert((await backlinkButton.count()) === 1, 'no backlink chip for ' + noteBId);
	await shot('10-backlinks');
	await backlinkButton.click();
	await sleep(500);
	const currentId = (await page.locator('span.font-mono.text-stone-400').first().innerText()).trim();
	assert(currentId === noteBId, 'clicking backlink opened ' + currentId);
	return `A shows "Linked from ${noteBId}"; clicking chip opens B`;
});
await step('E1-wiki-link-click-navigates', async () => {
	await page.locator('.tiptap .wiki-link').first().click();
	await sleep(600);
	const currentId = (await page.locator('span.font-mono.text-stone-400').first().innerText()).trim();
	assert(currentId === noteAId, 'wiki-link click opened ' + currentId);
	return `clicking [[${noteAId}]] in B opens A`;
});

// ---------------------------------------------------------------- Time entries (A4/A5/E1)
await page.getByRole('button', { name: 'Time Entries' }).click();
await page.getByText('Today', { exact: true }).first().waitFor({ timeout: 10000 });
await sleep(500);
const todaySection = page.locator('div.bg-amber-50\\/60').first();
await step('A5-new-entry-row-layout', async () => {
	await todaySection.getByTitle('Add entry').click();
	const description = page.locator('input[placeholder="What did you work on?"]');
	await description.waitFor({ timeout: 5000 });
	const descriptionBox = await description.boundingBox();
	const contractSelect = page.locator('div.mb-2.rounded-lg select');
	const timeInput = page.locator('input[placeholder="2h30m"]');
	const contractBox = await contractSelect.boundingBox();
	const timeBox = await timeInput.boundingBox();
	assert(descriptionBox.y < contractBox.y && Math.abs(contractBox.y - timeBox.y) < 10, 'layout rows wrong');
	assert(descriptionBox.width > contractBox.width + timeBox.width, 'description not full width');
	const hasDeliverable = (await page.locator('div.mb-2.rounded-lg select').count()) > 1 || (await page.getByText('Deliverable').count()) > 0;
	await page.getByRole('button', { name: 'Cancel' }).waitFor();
	await page.getByRole('button', { name: 'Save' }).waitFor();
	await shot('11-new-entry-row');
	if (!hasDeliverable) throw new Error('NewEntryRow has no deliverable input (only contract + time) — checklist expects contract, deliverable, time');
	return 'description full-width row 1; contract/deliverable/time row 2; Cancel/Save present';
});
await step('A5-border-updates-on-contract-select', async () => {
	const row = page.locator('div.mb-2.rounded-lg.border').first();
	const before = await row.getAttribute('class');
	await selectByText(row.locator('select'), 'Rocket Build');
	await sleep(200);
	const after = await row.getAttribute('class');
	assert(before.includes('border-l-stone-200') && !after.includes('border-l-stone-200'), `before="${before.match(/border-l-\S+/g)}" after="${after.match(/border-l-\S+/g)}"`);
	return `left border ${before.match(/border-l-[a-z]+-\d+/)[0]} -> ${after.match(/border-l-[a-z]+-\d+/)[0]}`;
});
await step('E1-create-time-entry-manual', async () => {
	await page.locator('input[placeholder="What did you work on?"]').fill('Build the rocket engine');
	await page.locator('input[placeholder="2h30m"]').fill('1h30m');
	await page.getByRole('button', { name: 'Save' }).click();
	const card = todaySection.locator('div.group');
	await card.first().waitFor({ timeout: 8000 });
	const text = await card.first().innerText();
	assert(text.includes('Build the rocket engine') && text.includes('1h 30m'), 'card: ' + text);
	await shot('12-entry-created');
	return `card shows "Build the rocket engine" / 1h 30m`;
});
await step('A4-card-hierarchy-and-colours', async () => {
	const card = todaySection.locator('div.group').first();
	const metrics = await card.evaluate((element) => {
		const description = element.querySelector('button[title="Click to edit description"]');
		const duration = element.querySelector('button[title="Click to edit time"]');
		const contract = element.querySelector('button[title="Click to change contract"]');
		const descriptionStyle = getComputedStyle(description);
		const durationStyle = getComputedStyle(duration);
		const contractStyle = getComputedStyle(contract);
		return {
			cardClass: element.className,
			borderLeftWidth: getComputedStyle(element).borderLeftWidth,
			borderLeftColor: getComputedStyle(element).borderLeftColor,
			descriptionColor: descriptionStyle.color, descriptionWeight: descriptionStyle.fontWeight, descriptionSize: descriptionStyle.fontSize,
			durationColor: durationStyle.color, durationAlign: durationStyle.textAlign,
			contractColor: contractStyle.color, contractSize: contractStyle.fontSize,
			dotClass: contract.querySelector('span.rounded-full')?.className,
			contractText: contract.innerText
		};
	});
	assert(metrics.borderLeftWidth === '3px', 'border-left ' + metrics.borderLeftWidth);
	const cardColor = (metrics.cardClass.match(/border-l-([a-z]+)-\d+/) || [])[1];
	const dotColor = (metrics.dotClass.match(/bg-([a-z]+)-\d+/) || [])[1];
	const sidebarColor = (sidebarDots['Rocket Build'] || '').match(/bg-([a-z]+)-/)?.[1];
	assert(cardColor && cardColor === dotColor && dotColor === sidebarColor, `colour mismatch card=${cardColor} dot=${dotColor} sidebar=${sidebarColor}`);
	assert(metrics.durationAlign === 'right', 'duration align ' + metrics.durationAlign);
	return `desc ${metrics.descriptionSize}/${metrics.descriptionWeight} ${metrics.descriptionColor}; duration ${metrics.durationColor} right; contract "${metrics.contractText.trim()}" ${metrics.contractSize} ${metrics.contractColor}; colour ${cardColor} consistent sidebar/card/dot`;
});
await step('A3-weekstrip-day-total-and-bar', async () => {
	const todayColumn = page.locator('.sticky.top-0 .grid-cols-7 > button.bg-amber-100');
	const hours = await todayColumn.locator('span').nth(2).innerText();
	assert(hours === '1.5h', 'today hours ' + hours);
	const segments = await todayColumn.locator('div.rounded-full > div').count();
	assert(segments === 1, 'bar segments ' + segments);
	const segmentClass = await todayColumn.locator('div.rounded-full > div').first().getAttribute('class');
	const weekly = await page.locator('.sticky.top-0 .w-32 span').first().innerText();
	assert(weekly === '1.5 hrs', 'weekly total ' + weekly);
	return `today column 1.5h, 1 colour segment (${segmentClass.match(/bg-[a-z]+-\d+/)[0]}), weekly total "${weekly}"`;
});
await step('E1-edit-time-entry-time', async () => {
	const card = todaySection.locator('div.group').first();
	await card.getByTitle('Click to edit time').click();
	const input = card.locator('input[placeholder="2h30m"]');
	await input.fill('09:00-11:15');
	await input.press('Enter');
	await card.getByTitle('Click to edit time').waitFor({ timeout: 5000 });
	await sleep(500);
	const text = await card.innerText();
	assert(text.includes('2h 15m') && /9:00/.test(text), 'card after time edit: ' + text);
	return `time edited to range 09:00-11:15 -> shows 2h 15m + range`;
});
await step('E1-edit-time-entry-contract', async () => {
	const card = todaySection.locator('div.group').first();
	await card.getByTitle('Click to change contract').click();
	await selectByText(card.locator('select'), 'General');
	await card.getByTitle('Click to change contract').waitFor({ timeout: 5000 });
	await sleep(400);
	const label = await card.getByTitle('Click to change contract').innerText();
	assert(label.includes('General'), 'contract label ' + label);
	const cardClass = await card.getAttribute('class');
	const colour = cardClass.match(/border-l-([a-z]+)-\d+/)[1];
	const sidebarColour = sidebarDots['General'].match(/bg-([a-z]+)-/)[1];
	assert(colour === sidebarColour, `card colour ${colour} vs sidebar ${sidebarColour}`);
	return `contract -> "${label.trim()}", border colour ${colour} matches sidebar`;
});
await step('A4-wiki-link-autocomplete-in-description', async () => {
	const card = todaySection.locator('div.group').first();
	await card.getByTitle('Click to edit description').click();
	const input = card.locator('input[placeholder^="Add description"]');
	await input.waitFor({ timeout: 5000 });
	await input.press('End');
	await input.type(' see [[' + noteAId.slice(0, 5), { delay: 40 });
	const dropdown = card.locator('div.z-50');
	await dropdown.waitFor({ timeout: 5000 });
	await sleep(600);
	const items = await dropdown.innerText();
	assert(items.includes(noteAId), 'dropdown: ' + items);
	await shot('13-description-autocomplete');
	await input.press('Enter');
	await sleep(200);
	const value = await input.inputValue();
	assert(value.includes(`[[${noteAId}]]`), 'value ' + value);
	await input.press('Enter');
	await sleep(1500);
	return `dropdown listed ${noteAId}; inserted [[${noteAId}]]`;
});
await step('A4-wiki-link-rendering-in-card', async () => {
	const card = todaySection.locator('div.group').first();
	await card.getByTitle('Click to edit description').waitFor({ timeout: 5000 });
	const html = await card.getByTitle('Click to edit description').innerHTML();
	const text = await card.getByTitle('Click to edit description').innerText();
	assert(text.includes(noteAId), 'description text: ' + text);
	const rendered = /<(a|button|span)[^>]*>[^<]*\[\[?[A-Z]+\.\d{8}\.\d{3}\]?\]?/.test(html) || html.includes('wiki');
	assert(rendered, 'wiki-link not rendered specially: ' + html.slice(0, 200));
	await shot('14-wiki-link-rendered');
	return `description renders ${noteAId} as link element`;
});
await step('C2-linked-time-entries-on-note', async () => {
	await page.getByRole('button', { name: /General/ }).click();
	await page.getByRole('button', { name: /Alpha note heading/ }).first().click();
	await page.locator('.tiptap').waitFor();
	await sleep(800);
	const panel = page.locator('h4', { hasText: /time entr/i });
	await panel.waitFor({ timeout: 8000 });
	const text = await panel.locator('..').innerText();
	assert(text.includes('rocket'), 'linked entries panel: ' + text);
	await shot('15-linked-time-entries');
	return `note A shows linked time entry: ${text.replace(/\s+/g, ' ').slice(0, 80)}`;
});

// ---------------------------------------------------------------- C. Note move
await step('C1-move-menu-visible-and-excludes-current', async () => {
	await page.getByRole('button', { name: /^Move/ }).click();
	const menu = page.locator('[data-move-menu] div.absolute');
	await menu.waitFor({ timeout: 5000 });
	const text = await menu.innerText();
	assert(text.includes('Rocket Build') && !text.includes('General'), 'move menu: ' + text);
	await shot('16-move-menu');
	return `move menu lists: ${text.replace(/\s+/g, ' ')}`;
});
await step('C1-move-note', async () => {
	const menu = page.locator('[data-move-menu] div.absolute');
	await menu.getByRole('button', { name: /Rocket Build/ }).click();
	const feedback = page.getByText(/Moved to/);
	let feedbackText = '';
	try { await feedback.waitFor({ timeout: 3000 }); feedbackText = await feedback.innerText(); } catch { feedbackText = '(feedback not observed)'; }
	await sleep(300);
	const stillListed = await page.getByRole('button', { name: /Alpha note heading/ }).count();
	await shot('17-after-move');
	assert(stillListed === 0, 'note still listed under General');
	const editorVisible = await page.locator('.tiptap').count();
	return `feedback "${feedbackText}"; note removed from General list; editor still open=${editorVisible > 0}`;
});
await step('C1-note-appears-in-target', async () => {
	await page.getByRole('button', { name: /Rocket Build/ }).first().click();
	const noteButton = page.getByRole('button', { name: /Alpha note heading/ });
	await noteButton.first().waitFor({ timeout: 8000 });
	await noteButton.first().click();
	await page.locator('.tiptap').waitFor();
	const currentId = (await page.locator('span.font-mono.text-stone-400').first().innerText()).trim();
	assert(currentId === noteAId, `id changed: ${currentId} != ${noteAId}`);
	const text = await page.locator('.tiptap').innerText();
	assert(text.includes('Alpha note heading') && text.includes('Added in raw mode'), 'content: ' + text.slice(0, 80));
	return `note ${noteAId} listed under Rocket Build, id unchanged (prefix preserved), content intact`;
});
await step('C2-backlinks-after-move', async () => {
	await page.getByText('Linked from').waitFor({ timeout: 8000 });
	const chip = page.locator('button.font-mono', { hasText: noteBId });
	assert((await chip.count()) === 1, 'no backlink chip after move');
	return `backlink from ${noteBId} still shown after move`;
});
await step('C2-linked-entries-after-move', async () => {
	const panel = page.locator('h4', { hasText: /time entr/i });
	await panel.waitFor({ timeout: 8000 });
	const text = await panel.locator('..').innerText();
	assert(text.includes('rocket'), 'linked entries: ' + text);
	return 'linked time entries still shown after move';
});
await step('C2-wiki-link-from-B-after-move', async () => {
	await page.getByRole('button', { name: /General/ }).click();
	await page.getByRole('button', { name: /Beta note/ }).first().waitFor({ timeout: 8000 });
	await page.getByRole('button', { name: /Beta note/ }).first().click();
	await page.locator('.tiptap .wiki-link').first().waitFor({ timeout: 8000 });
	await page.locator('.tiptap .wiki-link').first().click();
	await sleep(800);
	const currentId = (await page.locator('span.font-mono.text-stone-400').first().innerText()).trim();
	assert(currentId === noteAId, 'opened ' + currentId);
	const text = await page.locator('.tiptap').innerText();
	assert(text.includes('Alpha note heading'), 'content ' + text.slice(0, 60));
	await shot('18-cross-contract-wikilink');
	const listPanelText = await page.locator('.flex.flex-1.overflow-hidden > div').nth(1).innerText();
	return `[[${noteAId}]] from B (General) opens moved note; list panel now shows: ${listPanelText.replace(/\s+/g, ' ').slice(0, 60)}`;
});

// ---------------------------------------------------------------- A7 status, A3 nav, A9 timer
await page.getByRole('button', { name: 'Time Entries' }).click();
await page.locator('.sticky.top-0').first().waitFor();
await sleep(500);
await step('A7-status-chip-cycle', async () => {
	const chip = page.locator('.sticky.top-0 .w-32 button');
	const initial = await chip.innerText();
	assert(initial === 'Unsubmitted', 'initial ' + initial);
	const initialClass = await chip.getAttribute('class');
	await chip.click();
	await page.waitForResponse((response) => response.url().includes('weekly-status'), { timeout: 8000 }).catch(() => {});
	await sleep(400);
	const second = await chip.innerText();
	const secondClass = await chip.getAttribute('class');
	await chip.click();
	await sleep(600);
	const third = await chip.innerText();
	const thirdClass = await chip.getAttribute('class');
	assert(second === 'Draft ready' && third === 'Submitted', `cycle ${initial} -> ${second} -> ${third}`);
	assert(initialClass.includes('bg-stone-100') && secondClass.includes('bg-amber-100') && thirdClass.includes('bg-emerald-100'), 'chip colours wrong');
	await shot('19-status-submitted');
	return `${initial}(stone) -> ${second}(amber) -> ${third}(emerald); chip is a button, not a text input`;
});
await step('A7-status-persists-after-reload', async () => {
	await page.reload();
	await page.locator('.sticky.top-0 .w-32 button').waitFor({ timeout: 10000 });
	await sleep(800);
	const text = await page.locator('.sticky.top-0 .w-32 button').innerText();
	assert(text === 'Submitted', 'after reload: ' + text);
	return 'Submitted persisted after reload';
});
await step('A3-prev-next-week', async () => {
	const label = () => page.locator('.sticky.top-0 span.text-sm.font-medium.text-stone-700').first().innerText();
	const start = await label();
	await page.getByRole('button', { name: 'Previous week' }).click();
	await sleep(800);
	const previous = await label();
	await shot('20-previous-week');
	const daysShown = await page.locator('h2.text-sm.font-semibold').count();
	await page.getByRole('button', { name: 'Next week' }).click();
	await sleep(800);
	const back = await label();
	assert(previous !== start && back === start, `${start} -> ${previous} -> ${back}`);
	return `${start} -> ${previous} (${daysShown} day sections) -> ${back}`;
});
await step('A3-next-week-beyond-today', async () => {
	await page.getByRole('button', { name: 'Next week' }).click();
	await sleep(800);
	const sections = await page.locator('h2.text-sm.font-semibold').count();
	const body = await page.locator('.flex-1.overflow-y-auto.px-6').innerText();
	await shot('21-next-week');
	await page.getByRole('button', { name: 'Previous week' }).click();
	await sleep(500);
	return `future week shows ${sections} day sections; body: "${body.replace(/\s+/g, ' ').slice(0, 60)}"`;
});
await step('A3-click-day-scrolls', async () => {
	// Make the list scrollable? With only 7 days it may fit; verify the handler at least targets the section
	const mondayButton = page.locator('.sticky.top-0 .grid-cols-7 > button').first();
	await mondayButton.click();
	await sleep(600);
	const firstSectionBox = await page.locator('h2.text-sm.font-semibold').first().boundingBox();
	const stripBox = await page.locator('.sticky.top-0').first().boundingBox();
	assert(firstSectionBox.y >= stripBox.y + stripBox.height - 2, `Monday section y=${firstSectionBox.y} vs strip bottom ${stripBox.y + stripBox.height}`);
	return `Monday section top at y=${Math.round(firstSectionBox.y)} (strip bottom ${Math.round(stripBox.y + stripBox.height)}); sticky strip still visible`;
});
await step('A3-sticky-strip', async () => {
	const scroller = page.locator('.flex-1.overflow-y-auto.px-6');
	await scroller.evaluate((element) => { element.scrollTop = 400; });
	await sleep(300);
	const stripBox = await page.locator('.sticky.top-0').first().boundingBox();
	assert(stripBox.y >= 40 && stripBox.y < 60, 'strip y ' + stripBox.y);
	await scroller.evaluate((element) => { element.scrollTop = 0; });
	return `WeekStrip stays at y=${Math.round(stripBox.y)} after scrolling content`;
});

await step('A9-timer-indicator', async () => {
	await page.getByRole('button', { name: 'Start Timer' }).click();
	const indicator = page.locator('.timer-dot-running');
	await indicator.waitFor({ timeout: 8000 });
	await sleep(1500);
	const topbar = page.locator('div.h-12');
	let text = await topbar.innerText();
	assert(/0:00:0\d/.test(text), 'elapsed not shown: ' + text);
	await page.locator('#draft-description').fill('Timer-driven work on docs');
	await selectByText(page.locator('label[for="draft-contract"] + div select'), 'Rocket Build');
	await sleep(1800);
	text = await topbar.innerText();
	assert(text.includes('Timer-driven work') && text.includes('Rocket Build'), 'indicator text: ' + text);
	await shot('22-timer-running');
	await page.getByRole('button', { name: 'Toggle sidebar' }).click();
	await sleep(500);
	assert(await indicator.isVisible(), 'indicator hidden when sidebar collapsed');
	await indicator.click();
	await sleep(500);
	const sidebarWidth = (await page.locator('.flex.flex-1.overflow-hidden > div').first().boundingBox()).width;
	assert(sidebarWidth === 240, 'sidebar not reopened: ' + sidebarWidth);
	return `indicator: "${text.replace(/\s+/g, ' ').trim()}"; visible when collapsed; click reopens sidebar`;
});
await step('E1-timer-stop-save', async () => {
	await page.getByRole('button', { name: 'Stop' }).click();
	await page.getByRole('button', { name: 'Save' }).waitFor({ timeout: 8000 });
	const deliverableSelect = page.locator('#deliverable-select');
	let deliverableNote = 'no deliverable select shown';
	if (await deliverableSelect.count()) {
		await selectByText(deliverableSelect, 'Phase 1');
		deliverableNote = 'deliverable "Phase 1" selected';
		await sleep(400);
	}
	await shot('23-timer-completion');
	await page.getByRole('button', { name: 'Save' }).click();
	await page.getByRole('button', { name: 'Start Timer' }).waitFor({ timeout: 8000 });
	await sleep(800);
	const cards = todaySection.locator('div.group');
	const texts = await cards.allInnerTexts();
	const match = texts.find((text) => text.includes('Timer-driven work'));
	assert(match, 'timer entry not in today section: ' + JSON.stringify(texts));
	assert((await page.locator('.timer-dot-running').count()) === 0, 'indicator still visible after save');
	return `timer entry saved (${deliverableNote}); card: "${match.replace(/\s+/g, ' ').slice(0, 90)}"`;
});
await step('A4-deliverable-shown-on-card', async () => {
	const texts = await todaySection.locator('div.group').allInnerTexts();
	const match = texts.find((text) => text.includes('Timer-driven work'));
	assert(match && match.includes('Phase 1'), 'card lacks deliverable: ' + match);
	await shot('24-card-with-deliverable');
	return 'deliverable "Phase 1" shown on card (muted line)';
});
await step('E1-add-entry-modal-deliverable-selector', async () => {
	await page.getByRole('button', { name: 'Add Entry' }).click();
	await page.locator('#entry-date').waitFor({ timeout: 5000 });
	const modalText = await page.locator('#entry-date').locator('xpath=ancestor::div[contains(@class,"fixed")]').innerText().catch(() => '');
	const hasDeliverable = (await page.locator('#deliverable-select').count()) > 0 || /deliverable/i.test(modalText);
	await shot('25-add-entry-modal');
	await page.keyboard.press('Escape');
	const cancel = page.getByRole('button', { name: /Cancel|Close/ });
	if (await cancel.count()) await cancel.first().click().catch(() => {});
	if (!hasDeliverable) throw new Error('Add Entry modal has no deliverable selector (date, duration, contract, description only)');
	return 'Add Entry modal exposes deliverable selector';
});
await step('E1-delete-time-entry', async () => {
	const cards = todaySection.locator('div.group');
	const before = await cards.count();
	const target = cards.filter({ hasText: 'Timer-driven work' }).first();
	await target.hover();
	await target.getByTitle('Delete entry').click();
	await target.getByRole('button', { name: 'Yes' }).click();
	await sleep(1000);
	const after = await cards.count();
	assert(after === before - 1, `count ${before} -> ${after}`);
	return `entries ${before} -> ${after}`;
});

// ---------------------------------------------------------------- E1 delete note
await step('E1-delete-note', async () => {
	await page.getByRole('button', { name: /General/ }).click();
	await page.getByRole('button', { name: /Beta note/ }).first().waitFor({ timeout: 8000 });
	await page.getByRole('button', { name: /Beta note/ }).first().click();
	await page.locator('.tiptap').waitFor();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Delete' }).click();
	await sleep(800);
	const remaining = await page.getByRole('button', { name: /Beta note/ }).count();
	assert(remaining === 0, 'note still listed');
	const emptyEditor = await page.getByText('Select a note to view').count();
	return `note deleted; editor shows empty state=${emptyEditor > 0}`;
});

// ---------------------------------------------------------------- Layout shift check (A2)
await step('A2-no-layout-shift-switching-modes', async () => {
	await page.getByRole('button', { name: 'Time Entries' }).click();
	await sleep(400);
	const topbarA = await page.locator('div.h-12').boundingBox();
	const sidebarA = await page.locator('.flex.flex-1.overflow-hidden > div').first().boundingBox();
	await page.getByRole('button', { name: /General/ }).click();
	await sleep(400);
	const topbarB = await page.locator('div.h-12').boundingBox();
	const sidebarB = await page.locator('.flex.flex-1.overflow-hidden > div').first().boundingBox();
	assert(topbarA.height === topbarB.height && sidebarA.width === sidebarB.width, 'shift detected');
	return `top bar and sidebar geometry identical across modes (sidebar ${sidebarA.width}px)`;
});

await page.goto(BASE + '/');
await sleep(1500);
await shot('26-final-state');

writeFileSync(OUT, JSON.stringify({ user: USER.email, noteAId, noteBId, results, consoleErrors, pageErrors, failedRequests, navigations }, null, 2));
console.log('\nSUMMARY', results.filter((r) => r.status === 'PASS').length, 'pass /', results.filter((r) => r.status === 'FAIL').length, 'fail');
console.log('console errors:', consoleErrors.length, 'page errors:', pageErrors.length, 'failed requests:', failedRequests.length);
await browser.close();
