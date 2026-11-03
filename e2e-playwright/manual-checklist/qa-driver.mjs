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
async function selectByText(selectLocator, text, timeoutMs = 5000) {
	// Options are fetched after mount (ContractSelect, DeliverableSelect): poll until the wanted one exists
	const deadline = Date.now() + timeoutMs;
	let value = null;
	let seen = [];
	while (Date.now() < deadline) {
		const probe = await selectLocator.evaluate((element, wanted) => {
			const options = Array.from(element.options);
			const option = options.find((candidate) => candidate.textContent.includes(wanted));
			return { value: option && !element.disabled ? option.value : null, seen: options.map((candidate) => candidate.textContent.trim()) };
		}, text);
		value = probe.value;
		seen = probe.seen;
		if (value) break;
		await new Promise((resolve) => setTimeout(resolve, 150));
	}
	if (!value) throw new Error(`no enabled <option> containing "${text}" (options: ${seen.join(' | ')})`);
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

// Sidebar (panel 1) contract buttons; time cards also carry "<client> / <contract>" buttons
const sidebarPanel = page.locator('.flex.flex-1.overflow-hidden > div').first();
const sidebarContract = (pattern) => sidebarPanel.getByRole('button', { name: pattern });
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
	// Since 020-CL: Better Auth signs the new user in and /login bounces an authenticated user to /
	await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 });
	await page.getByRole('button', { name: 'Time Entries' }).waitFor({ timeout: 15000 });
	await shot('00-after-register');
	return `registered ${USER.email}, landed signed in on ${page.url()} in ${Date.now() - started}ms`;
});

await step('AUTH-login-page-when-authenticated', async () => {
	await page.goto(BASE + '/login');
	await page.waitForURL((url) => url.pathname === '/', { timeout: 10000 });
	await page.getByRole('button', { name: 'Time Entries' }).waitFor({ timeout: 15000 });
	return `visiting /login while authenticated redirects to ${page.url()}`;
});

await step('AUTH-login-redirect', async () => {
	// Sign out (drop the session cookie) so the login form is reachable again
	await context.clearCookies();
	await page.goto(BASE + '/login');
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

// Native-submit race probe: submit the login form BEFORE hydration completes.
await step('AUTH-native-submit-race', async () => {
	// Fresh, unauthenticated context: the main page's session would redirect /login to /
	const probeContext = await browser.newContext();
	const probePage = await probeContext.newPage();
	// Slow down hydration: delay every script (prod serves /_app/**, dev serves /src, /@fs, /node_modules/.vite)
	await probePage.route('**/*', async (route) => {
		if (route.request().resourceType() === 'script') await sleep(1500);
		await route.continue();
	});
	await probePage.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
	await probePage.locator('#email').fill(USER.email);
	await probePage.locator('#password').fill(USER.password);
	await probePage.locator('button[type="submit"]').click();
	await sleep(3000);
	const url = probePage.url();
	await probeContext.close();
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
	await sidebarContract(/Rocket Build/).waitFor({ timeout: 10000 });
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
	await sidebarContract(/General/).click();
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
	await sidebarContract(/General/).click();
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
	// Full id: a shared prefix + Enter picks the first (most recent) suggestion, which is this note itself
	await page.keyboard.type(noteAId, { delay: 30 });
	const dropdown = page.locator('body > div.absolute.z-50');
	await dropdown.waitFor({ timeout: 8000 });
	await sleep(500);
	const items = await dropdown.innerText();
	assert(items.includes(noteAId), 'dropdown items: ' + items);
	await shot('09-wiki-link-autocomplete');
	await page.keyboard.press('Enter');
	await sleep(300);
	const link = page.locator('.tiptap .wiki-link');
	assert((await link.count()) === 1, 'no wiki-link node inserted');
	const linkTarget = await link.first().getAttribute('data-note-id');
	assert(linkTarget === noteAId, `wiki-link points at ${linkTarget}, expected ${noteAId}`);
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
const newEntryRow = page.locator('div.mb-2.rounded-lg.border').filter({ has: page.locator('input[placeholder="What did you work on?"]') }).first();
const newEntryField = (labelText) => newEntryRow.locator('div').filter({ has: page.locator('label', { hasText: new RegExp('^' + labelText + '$') }) }).last().locator('select');
await step('A5-new-entry-row-layout', async () => {
	await todaySection.getByTitle('Add entry').click();
	const description = page.locator('input[placeholder="What did you work on?"]');
	await description.waitFor({ timeout: 5000 });
	const descriptionBox = await description.boundingBox();
	const contractSelect = newEntryField('Contract');
	const deliverableSelect = newEntryField('Deliverable');
	const timeInput = newEntryRow.locator('input[placeholder="1h30m or 9:00-10:30"]');
	assert((await contractSelect.count()) === 1, 'no Contract select in new entry row');
	assert((await deliverableSelect.count()) === 1, 'NewEntryRow has no Deliverable select — checklist expects contract, deliverable, time');
	const contractBox = await contractSelect.boundingBox();
	const deliverableBox = await deliverableSelect.boundingBox();
	const timeBox = await timeInput.boundingBox();
	assert(descriptionBox.y < contractBox.y && Math.abs(contractBox.y - timeBox.y) < 10 && Math.abs(contractBox.y - deliverableBox.y) < 10, 'layout rows wrong');
	assert(contractBox.x < deliverableBox.x && deliverableBox.x < timeBox.x, 'row 2 order is not contract, deliverable, time');
	assert(descriptionBox.width > contractBox.width + timeBox.width, 'description not full width');
	const deliverableDisabled = await deliverableSelect.isDisabled();
	const deliverablePlaceholder = (await deliverableSelect.innerText()).trim();
	assert(deliverableDisabled, 'deliverable select enabled before a contract is chosen');
	await newEntryRow.getByRole('button', { name: 'Cancel' }).waitFor();
	await newEntryRow.getByRole('button', { name: 'Save' }).waitFor();
	await shot('11-new-entry-row');
	return `description full-width row 1; contract/deliverable/time row 2 (deliverable disabled: "${deliverablePlaceholder}"); Cancel/Save present`;
});
await step('A5-border-updates-on-contract-select', async () => {
	const row = newEntryRow;
	const before = await row.getAttribute('class');
	await selectByText(newEntryField('Contract'), 'Rocket Build');
	await sleep(200);
	const after = await row.getAttribute('class');
	assert(before.includes('border-l-stone-200') && !after.includes('border-l-stone-200'), `before="${before.match(/border-l-\S+/g)}" after="${after.match(/border-l-\S+/g)}"`);
	return `left border ${before.match(/border-l-[a-z]+-\d+/)[0]} -> ${after.match(/border-l-[a-z]+-\d+/)[0]}`;
});
await step('A5-new-entry-row-deliverable', async () => {
	const deliverableSelect = newEntryField('Deliverable');
	await selectByText(deliverableSelect, 'Phase 1');
	const workTypeVisible = await newEntryField('Work type').isVisible().catch(() => false);
	return `deliverable "Phase 1" selectable after choosing Rocket Build; work type field visible=${workTypeVisible} (deliverable has no work types)`;
});
await step('E1-create-time-entry-manual', async () => {
	await newEntryRow.locator('input[placeholder="What did you work on?"]').fill('Build the rocket engine');
	await newEntryRow.locator('input[placeholder="1h30m or 9:00-10:30"]').fill('1h30m');
	await newEntryRow.getByRole('button', { name: 'Save' }).click();
	const card = todaySection.locator('div.group');
	await card.first().waitFor({ timeout: 8000 });
	const text = await card.first().innerText();
	assert(text.includes('Build the rocket engine') && text.includes('1h 30m'), 'card: ' + text);
	assert(text.includes('Phase 1'), 'deliverable picked in the new entry row not shown on card: ' + text.replace(/\s+/g, ' '));
	await shot('12-entry-created');
	return `card shows "Build the rocket engine" / 1h 30m / Phase 1`;
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
	assert(hours === '1h30', 'today hours ' + hours);
	const segments = await todayColumn.locator('div.rounded-full > div').count();
	assert(segments === 1, 'bar segments ' + segments);
	const segmentClass = await todayColumn.locator('div.rounded-full > div').first().getAttribute('class');
	const weekly = await page.locator('.sticky.top-0 .sm\\:w-32 span').first().innerText();
	assert(weekly === '1h 30m', 'weekly total ' + weekly);
	return `today column 1h30, 1 colour segment (${segmentClass.match(/bg-[a-z]+-\d+/)[0]}), weekly total "${weekly}"`;
});
await step('E1-edit-time-entry-time', async () => {
	const card = todaySection.locator('div.group').first();
	await card.getByTitle('Click to edit time').click();
	const input = card.locator('input[placeholder="1h30m or 9:00-10:30"]');
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
	const input = card.locator('input[placeholder^="What did you work on"]');
	await input.waitFor({ timeout: 5000 });
	await input.press('End');
	// Full id, not a shared prefix: Enter picks the first (most recent) suggestion
	await input.type(' see [[' + noteAId, { delay: 40 });
	const dropdown = card.locator('div.z-50');
	await dropdown.waitFor({ timeout: 5000 });
	await sleep(600);
	const items = await dropdown.innerText();
	assert(items.includes(noteAId), 'dropdown: ' + items);
	await shot('13-description-autocomplete');
	await input.press('Enter');
	await sleep(200);
	const value = await input.inputValue();
	if (!value.includes(`[[${noteAId}]]`)) {
		// Record the failure, but save the intended link so the downstream seams (card click,
		// linked time entries, move) are still exercised instead of cascading
		await input.fill(value.replace(/\[\[[^\]]*\]\]\s*$/, `[[${noteAId}]]`));
		await sleep(200);
		await input.press('Enter');
		await sleep(1500);
		throw new Error(`typed the exact id ${noteAId} + Enter but got "${value}"; dropdown order: ${items.replace(/\s+/g, ' ').slice(0, 160)} (description corrected by hand so later steps can run)`);
	}
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
await step('A4-card-wiki-link-click-opens-note', async () => {
	const card = todaySection.locator('div.group').first();
	await card.getByTitle(`Go to note ${noteAId}`).click();
	await page.locator('.tiptap').waitFor({ timeout: 8000 });
	await sleep(600);
	const currentId = (await page.locator('span.font-mono.text-stone-400').first().innerText()).trim();
	assert(currentId === noteAId, 'card wiki-link opened ' + currentId);
	const text = await page.locator('.tiptap').innerText();
	assert(text.includes('Alpha note heading'), 'editor content: ' + text.slice(0, 60));
	await shot('14b-card-wiki-link-opened-note');
	return `clicking [[${noteAId}]] on the card switched to notes mode with ${noteAId} open`;
});
await step('C2-linked-time-entries-on-note', async () => {
	await sidebarContract(/General/).click();
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
	const feedback = page.getByTestId('move-feedback');
	await feedback.waitFor({ timeout: 3000 });
	const feedbackText = (await feedback.innerText()).trim();
	assert(feedbackText === 'Moved to Acme Corp / Rocket Build', 'move feedback: ' + feedbackText);
	await sleep(300);
	const stillListed = await page.getByRole('button', { name: /Alpha note heading/ }).count();
	await shot('17-after-move');
	assert(stillListed === 0, 'note still listed under General');
	const editorVisible = await page.locator('.tiptap').count();
	return `feedback "${feedbackText}"; note removed from General list; editor still open=${editorVisible > 0}`;
});
await step('C1-note-appears-in-target', async () => {
	await sidebarContract(/Rocket Build/).first().click();
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
	await sidebarContract(/General/).click();
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

await step('C2-card-wiki-link-after-move', async () => {
	await page.getByRole('button', { name: 'Time Entries' }).click();
	await page.getByText('Today', { exact: true }).first().waitFor({ timeout: 10000 });
	await sleep(500);
	const card = todaySection.locator('div.group').filter({ hasText: 'rocket' }).first();
	await card.getByTitle(`Go to note ${noteAId}`).click();
	await page.locator('.tiptap').waitFor({ timeout: 8000 });
	await sleep(600);
	const currentId = (await page.locator('span.font-mono.text-stone-400').first().innerText()).trim();
	assert(currentId === noteAId, 'card wiki-link opened ' + currentId);
	const listPanelText = await page.locator('.flex.flex-1.overflow-hidden > div').nth(1).innerText();
	assert(listPanelText.includes('Alpha note heading') && !listPanelText.includes('Beta note'), 'list panel not on the moved-to contract: ' + listPanelText.replace(/\s+/g, ' ').slice(0, 120));
	return `card [[${noteAId}]] opens the moved note under Rocket Build`;
});

// ---------------------------------------------------------------- A7 status, A3 nav, A9 timer
await page.getByRole('button', { name: 'Time Entries' }).click();
await page.locator('.sticky.top-0').first().waitFor();
await sleep(500);
await step('A7-status-menu', async () => {
	// Since 025-CL the pill opens a menu of the three states instead of cycling blindly
	const chip = page.getByRole('button', { name: /Week status:/ });
	const chipText = async () => (await chip.innerText()).replace('▾', '').trim();
	const initial = await chipText();
	assert(initial === 'Unsubmitted', 'initial ' + initial);
	const initialClass = await chip.getAttribute('class');
	await chip.click();
	const options = await page.getByRole('menuitemradio').count();
	assert(options === 3, 'menu options ' + options);
	await page.getByRole('menuitemradio', { name: /Draft ready/ }).click();
	await page.waitForResponse((response) => response.url().includes('weekly-status'), { timeout: 8000 }).catch(() => {});
	await sleep(400);
	const second = await chipText();
	const secondClass = await chip.getAttribute('class');
	await chip.click();
	await page.getByRole('menuitemradio', { name: /Submitted/ }).click();
	await sleep(600);
	const third = await chipText();
	const thirdClass = await chip.getAttribute('class');
	assert(second === 'Draft ready' && third === 'Submitted', `menu ${initial} -> ${second} -> ${third}`);
	assert(initialClass.includes('bg-stone-100') && secondClass.includes('bg-amber-100') && thirdClass.includes('bg-emerald-100'), 'chip colours wrong');
	await shot('19-status-submitted');
	return `${initial}(stone) -> ${second}(amber) -> ${third}(emerald) via a 3-option menu`;
});
await step('A7-status-persists-after-reload', async () => {
	await page.reload();
	await page.getByRole('button', { name: /Week status:/ }).waitFor({ timeout: 10000 });
	await sleep(800);
	const text = (await page.getByRole('button', { name: /Week status:/ }).innerText()).replace('▾', '').trim();
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
	const body = await page.locator('.flex-1.overflow-y-auto.px-4').innerText();
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
	const scroller = page.locator('.flex-1.overflow-y-auto.px-4');
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
	const deliverableSelect = page.locator('#timer-deliverable');
	await deliverableSelect.waitFor({ timeout: 5000 }).catch(() => {});
	assert((await deliverableSelect.count()) === 1, 'timer completion form has no deliverable select');
	await selectByText(deliverableSelect, 'Phase 1');
	const deliverableNote = 'deliverable "Phase 1" selected';
	await sleep(400);
	await shot('23-timer-completion');
	await page.getByRole('button', { name: 'Save' }).click();
	await page.getByRole('button', { name: 'Start Timer' }).waitFor({ timeout: 8000 });
	await sleep(800);
	// No reload: the card must appear via the time-entry-saved event (019-CL task 2)
	const cards = todaySection.locator('div.group');
	await cards.filter({ hasText: 'Timer-driven work' }).first().waitFor({ timeout: 5000 }).catch(() => {});
	const texts = await cards.allInnerTexts();
	const match = texts.find((text) => text.includes('Timer-driven work'));
	assert(match, 'timer entry not in today section without reload: ' + JSON.stringify(texts));
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
	await page.getByRole('button', { name: 'Add Entry', exact: true }).click();
	await page.locator('#entry-date').waitFor({ timeout: 5000 });
	const modalText = await page.locator('#entry-date').locator('xpath=ancestor::div[contains(@class,"fixed")]').innerText().catch(() => '');
	const hasDeliverable = (await page.locator('#deliverable-select').count()) > 0;
	const modalHasWorkTypeLabel = (await page.locator('label[for="work-type-select"]').count()) > 0 || /work type/i.test(modalText);
	await shot('25-add-entry-modal');
	await page.keyboard.press('Escape');
	const cancel = page.getByRole('button', { name: /Cancel|Close/ });
	if (await cancel.count()) await cancel.first().click().catch(() => {});
	if (!hasDeliverable) throw new Error('Add Entry modal has no deliverable selector (date, duration, contract, description only)');
	return `Add Entry modal exposes #deliverable-select (work type field present=${modalHasWorkTypeLabel})`;
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
	await sidebarContract(/General/).click();
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
	await sidebarContract(/General/).click();
	await sleep(400);
	const topbarB = await page.locator('div.h-12').boundingBox();
	const sidebarB = await page.locator('.flex.flex-1.overflow-hidden > div').first().boundingBox();
	assert(topbarA.height === topbarB.height && sidebarA.width === sidebarB.width, 'shift detected');
	return `top bar and sidebar geometry identical across modes (sidebar ${sidebarA.width}px)`;
});

await page.goto(BASE + '/');
await sleep(1500);
await shot('26-final-state');

// ---------------------------------------------------------------- Mobile (375px): top bar + timesheet
await step('M1-mobile-topbar-and-timesheet', async () => {
	const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, storageState: await context.storageState() });
	const mobilePage = await mobileContext.newPage();
	const mobileErrors = [];
	mobilePage.on('pageerror', (error) => { mobileErrors.push(error.message.slice(0, 200)); pageErrors.push(`[mobile] ${mobilePage.url()} :: ${error.message.slice(0, 400)}`); });
	try {
		await mobilePage.goto(BASE + '/');
		await mobilePage.waitForLoadState('networkidle');
		const topBar = mobilePage.locator('div.h-12').first();
		const rootText = (await topBar.innerText()).trim();
		assert(rootText.includes('Chronolog'), 'level-0 top bar: ' + rootText);
		await mobilePage.getByRole('button', { name: 'Time Entries' }).click();
		const strip = mobilePage.locator('.sticky.top-0').first();
		await strip.waitFor({ timeout: 10000 });
		await mobilePage.getByRole('button', { name: /Back/ }).waitFor({ timeout: 5000 });
		await sleep(800);
		const topBox = await topBar.boundingBox();
		const stripBox = await strip.boundingBox();
		assert(topBox.y === 0 && topBox.height === 48, 'top bar box ' + JSON.stringify(topBox));
		assert(stripBox.y >= 47 && stripBox.y < 120, 'WeekStrip y ' + stripBox.y);
		const dayButtons = strip.locator('.grid-cols-7 > button');
		assert((await dayButtons.count()) === 7, 'day columns ' + (await dayButtons.count()));
		const lastDayBox = await dayButtons.nth(6).boundingBox();
		assert(lastDayBox.x + lastDayBox.width <= 376, 'Sunday column clipped at x=' + (lastDayBox.x + lastDayBox.width));
		const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
		assert(overflow <= 0, `horizontal overflow ${overflow}px`);
		const scroller = mobilePage.locator('.flex-1.overflow-y-auto.px-4').first();
		if (await scroller.count()) { await scroller.evaluate((element) => { element.scrollTop = 400; }); await sleep(300); }
		const stripAfterScroll = await strip.boundingBox();
		const topAfterScroll = await topBar.boundingBox();
		assert(topAfterScroll.y === 0, 'top bar scrolled away: y=' + topAfterScroll.y);
		assert(stripAfterScroll.y >= 47 && stripAfterScroll.y < 120, 'WeekStrip not sticky under the top bar: y=' + stripAfterScroll.y);
		const cardTexts = await mobilePage.locator('div.group').allInnerTexts();
		await mobilePage.screenshot({ path: `${SHOTS}/27-mobile-timesheet.png` });
		await mobilePage.getByRole('button', { name: /Back/ }).click();
		await sleep(400);
		assert((await topBar.innerText()).includes('Chronolog'), 'Back did not return to level 0');
		assert(mobileErrors.length === 0, 'page errors: ' + mobileErrors.join(' | '));
		return `top bar "Chronolog" -> "← Back" at y=0 h=48; WeekStrip y=${Math.round(stripBox.y)} (after scroll ${Math.round(stripAfterScroll.y)}), 7 columns fit; no horizontal overflow; ${cardTexts.length} card(s); Back returns to level 0`;
	} finally {
		await mobileContext.close();
	}
});

writeFileSync(OUT, JSON.stringify({ user: USER.email, noteAId, noteBId, results, consoleErrors, pageErrors, failedRequests, navigations }, null, 2));
console.log('\nSUMMARY', results.filter((r) => r.status === 'PASS').length, 'pass /', results.filter((r) => r.status === 'FAIL').length, 'fail');
console.log('console errors:', consoleErrors.length, 'page errors:', pageErrors.length, 'failed requests:', failedRequests.length);
await browser.close();
