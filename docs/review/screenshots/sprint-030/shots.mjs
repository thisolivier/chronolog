/**
 * Sprint 030-CL before/after screenshots for tasks 1, 2, 4 and 5, against a real dev server.
 *
 *   node docs/review/screenshots/sprint-030/shots.mjs before|after [baseUrl]
 *
 * Registers a fresh `qa-030-*` user (the server needs ALLOW_REGISTRATION=true), seeds a client
 * with two contracts, a deliverable and work type, entries today and yesterday, and a
 * "Formerly" entry made by deleting a deliverable, then shoots at 1280 px and 390 px.
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const phase = process.argv[2] ?? 'after';
const baseUrl = process.argv[3] ?? 'http://localhost:5208';
const outputDirectory = path.dirname(fileURLToPath(import.meta.url));
const suffix = Date.now().toString(36);
const email = `qa-030-${phase}-${suffix}@chronolog.test`;
const password = 'TestPassword123!';
const measurements = [];

function isoDate(date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function register(page) {
	await page.goto(`${baseUrl}/register`);
	await page.waitForLoadState('networkidle');
	await page.locator('#name').fill('QA 030');
	await page.locator('#email').fill(email);
	await page.locator('#password').fill(password);
	await page.locator('#confirm-password').fill(password);
	await page.locator('button[type="submit"]').click();
	await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 });
	await page.getByRole('button', { name: 'Time Entries' }).first().waitFor();
	await page.waitForLoadState('networkidle');
}

/** Seed through the JSON API and the admin form actions, as the signed-in user */
async function seed(page) {
	const today = new Date();
	const yesterday = new Date();
	yesterday.setDate(today.getDate() - 1);
	return page.evaluate(
		async ({ suffix, todayDate, yesterdayDate }) => {
			const post = async (url, body) => {
				const response = await fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
				if (!response.ok) throw new Error(`${url} ${response.status}`);
				return response.json();
			};
			const action = async (url, fields) => {
				const form = new FormData();
				for (const [key, value] of Object.entries(fields)) form.append(key, value);
				const response = await fetch(url, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
				const result = await response.json();
				if (result.type !== 'success') throw new Error(`${url} ${JSON.stringify(result)}`);
			};
			const shortCode = `Q${suffix.slice(-3).toUpperCase()}`;
			await action('/admin/clients?/create', { name: 'Acme Corp', short_code: shortCode, color_index: '1' });
			const contractsBefore = await (await fetch('/api/contracts')).json();
			const generalContract = contractsBefore[0];
			const clients = await (await fetch('/api/clients')).json();
			const clientList = clients.clients ?? clients;
			const acme = clientList.find((client) => client.shortCode === shortCode);
			const rocket = (await post('/api/contracts', { clientId: acme.id, name: 'Rocket Build', isActive: true })).contract.id;
			const data = (await post('/api/contracts', { clientId: acme.id, name: 'Data Platform', isActive: true })).contract.id;
			const contractPage = (contractId) => `/admin/clients/${acme.id}/contracts/${contractId}`;
			await action(`${contractPage(data)}?/createDeliverable`, { name: 'Data Phase 2', sort_order: '0' });
			await action(`${contractPage(rocket)}?/createDeliverable`, { name: 'Legacy Phase', sort_order: '0' });
			const dataDeliverable = (await (await fetch(`/api/deliverables?contractId=${data}`)).json())[0];
			const legacyDeliverable = (await (await fetch(`/api/deliverables?contractId=${rocket}`)).json())[0];
			await action(`${contractPage(data)}?/createWorkType`, { deliverable_id: dataDeliverable.id, name: 'Build', sort_order: '0' });
			const workType = (await (await fetch(`/api/work-types?deliverableId=${dataDeliverable.id}`)).json())[0];
			const entry = (body) => post('/api/time-entries', body);
			await entry({ date: yesterdayDate, durationMinutes: 60, contractId: rocket, description: 'Engine design review', startTime: '09:00', endTime: '10:00' });
			await entry({ date: yesterdayDate, durationMinutes: 45, contractId: generalContract.id, description: 'Admin and invoicing' });
			const pipeline = await entry({
				date: todayDate,
				durationMinutes: 90,
				contractId: data,
				deliverableId: dataDeliverable.id,
				workTypeId: workType.id,
				description: 'Pipeline build',
				startTime: '09:00',
				endTime: '10:30'
			});
			await entry({ date: todayDate, durationMinutes: 30, contractId: rocket, deliverableId: legacyDeliverable.id, description: 'Sprint review with the client' });
			await action(`${contractPage(rocket)}?/deleteDeliverable`, { deliverable_id: legacyDeliverable.id });
			return { rocket, data, pipelineId: (pipeline.entry ?? pipeline).id, deliverableId: dataDeliverable.id, workTypeId: workType.id };
		},
		{ suffix, todayDate: isoDate(today), yesterdayDate: isoDate(yesterday) }
	);
}

async function openTimesheet(page) {
	await page.goto(`${baseUrl}/time`);
	await page.waitForLoadState('networkidle');
	await page.locator('[data-testid="time-entry-card"]').first().waitFor();
	await page.waitForTimeout(400);
}

const cardByText = (page, text) => page.locator('[data-testid="time-entry-card"]', { hasText: text }).first();

async function shoot(page, name) {
	await page.screenshot({ path: path.join(outputDirectory, `${name}.png`) });
}

async function cardLeftEdges(page, label) {
	const edges = await page.$$eval('[data-day]', (days) =>
		days
			.map((day) => {
				const card = day.querySelector('[data-testid="time-entry-card"]');
				return card ? { day: day.getAttribute('data-day'), left: Math.round(card.getBoundingClientRect().left) } : null;
			})
			.filter(Boolean)
	);
	measurements.push(`${label} card left edges: ${edges.map((edge) => `${edge.day}=${edge.left}`).join(', ')}`);
}

async function run(width, seeded, page) {
	const tag = width >= 1000 ? 'desktop' : 'phone';
	await page.setViewportSize({ width, height: width >= 1000 ? 800 : 844 });

	// Task 1: today's cards against yesterday's
	await openTimesheet(page);
	const yesterdayCard = cardByText(page, 'Engine design review');
	await yesterdayCard.scrollIntoViewIfNeeded();
	await page.locator('[data-testid="timesheet-scroll"]').evaluate((element) => element.scrollBy(0, -120));
	await cardLeftEdges(page, `${phase} ${tag}`);
	await shoot(page, `t1-${phase}-${tag}-today-alignment`);

	// Task 5: the "Formerly" line on a card
	const formerlyCard = cardByText(page, 'Sprint review with the client');
	await formerlyCard.scrollIntoViewIfNeeded();
	await formerlyCard.screenshot({ path: path.join(outputDirectory, `t5-${phase}-${tag}-formerly-line.png`) });

	// Task 2: timer pill with no contract, beside the widget
	const widget = page.locator('[data-testid^="timer-widget-"]').first();
	await widget.getByRole('button', { name: 'Start Timer' }).click();
	await page.waitForTimeout(2300);
	const pill = page.locator('button:has([class*="timer-dot-running"])').first();
	const pillText = await pill.innerText().catch(() => '(no pill)');
	const pillBorder = await pill.evaluate((element) => getComputedStyle(element).borderLeftColor).catch(() => '');
	const widgetTime = await widget.locator('.font-mono').first().innerText();
	measurements.push(`${phase} ${tag} widget time "${widgetTime.trim()}"; pill "${pillText.replace(/\s+/g, ' ').trim()}" border ${pillBorder}`);
	await shoot(page, `t2-${phase}-${tag}-timer-no-contract`);
	await widget.getByRole('button', { name: 'Stop' }).click();
	await widget.getByRole('button', { name: /Discard/ }).click();
	await page.waitForTimeout(300);

	// Task 4: change the contract of the card holding a deliverable
	const pipelineCard = cardByText(page, 'Pipeline build');
	await pipelineCard.scrollIntoViewIfNeeded();
	await pipelineCard.screenshot({ path: path.join(outputDirectory, `t4-${phase}-${tag}-1-before-change.png`) });
	await pipelineCard.getByTitle('Click to change contract').click();
	await pipelineCard.locator('select').first().selectOption({ label: 'Acme Corp / Rocket Build' });
	await page.waitForTimeout(800);
	await pipelineCard.screenshot({ path: path.join(outputDirectory, `t4-${phase}-${tag}-2-after-change.png`) });
	const savedEntry = await page.evaluate(async ({ entryId, todayDate }) => {
		const response = await fetch(`/api/time-entries?from=${todayDate}&to=${todayDate}`);
		const body = await response.json();
		return body.entries.find((entry) => entry.id === entryId) ?? {};
	}, { entryId: seeded.pipelineId, todayDate: isoDate(new Date()) });
	measurements.push(`${phase} ${tag} saved after contract change: contract=${savedEntry.contractId === seeded.rocket ? 'Rocket Build' : savedEntry.contractId} deliverable=${savedEntry.deliverableId} workType=${savedEntry.workTypeId}`);
	// Put contract, deliverable and work type back for the next width
	await page.evaluate(
		async ({ entryId, contractId, deliverableId, workTypeId }) =>
			fetch(`/api/time-entries/${entryId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contractId, deliverableId, workTypeId })
			}),
		{ entryId: seeded.pipelineId, contractId: seeded.data, deliverableId: seeded.deliverableId, workTypeId: seeded.workTypeId }
	);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (error) => measurements.push(`pageerror: ${error.message}`));
await register(page);
const seeded = await seed(page);
await run(1280, seeded, page);
await run(390, seeded, page);
await browser.close();
console.log(`user ${email}`);
console.log(measurements.join('\n'));
