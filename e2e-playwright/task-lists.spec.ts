/**
 * Sprint 040-CL: checkbox task lists in notes. Typed in the editor (`[ ] ` in a list item, the
 * toolbar button, nesting with Tab), ticked with a click and still ticked after a reload; a note
 * written by the CLI as markdown only (`- [ ]`) opens with checkboxes; `chronolog todos` lists it.
 */
import { test, expect, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { editor, noteListItem, sidebarContract, createNote } from './notes-helpers';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const CURRENT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(CURRENT_DIRECTORY, '..', 'cli', 'chronolog.mjs');
const SCREENSHOTS = sprintScreenshotDirectory('sprint-040');

function runCli(args: string[], environment: Record<string, string>, stdinText = '') {
	return new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
		const child = execFile(process.execPath, [CLI_PATH, ...args], { env: { ...process.env, ...environment } }, (error, stdout, stderr) =>
			resolve({ exitCode: error ? Number(error.code ?? 1) : 0, stdout, stderr })
		);
		child.stdin?.end(stdinText);
	});
}

const taskItems = (page: Page) => editor(page).locator('ul[data-type="taskList"] > li');
const checkbox = (page: Page, text: string) =>
	editor(page).locator('ul[data-type="taskList"] > li', { has: page.locator(':scope > div > p', { hasText: text }) }).locator(':scope > label input[type="checkbox"]');

/** The note's saved markdown once it contains `expected` (a click saves after the 500 ms debounce). */
async function savedContent(page: Page, noteId: string, expected: string): Promise<string> {
	const read = () => page.evaluate(async (id) => (await (await fetch(`/api/notes/${id}`)).json()).note.content as string, noteId);
	await expect.poll(read, { timeout: 10000 }).toContain(expected);
	return read();
}

test('a task list typed in the editor: nested, ticked, still ticked after a reload', async ({ page, browserName }) => {
	const suffix = `${Date.now().toString(36)}${browserName.slice(0, 2)}`;
	const firstLine = `Task list note ${suffix}`;

	await page.goto('/');
	await sidebarContract(page, 'General').click();
	const noteId = await createNote(page, firstLine);
	await page.keyboard.press('Enter');

	// a bullet item turned into a task item by typing [ ]
	await page.keyboard.type('- ');
	await page.keyboard.type('[ ] Call Jane about the budget');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Send the report');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Tab');
	await page.keyboard.type('Attach the figures');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Check the totals');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Shift+Tab');
	await page.keyboard.type('Book the review');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');

	// the toolbar button makes a second task list from a plain line
	await page.keyboard.type('Later');
	await page.locator('[data-toolbar-task-list]').click();
	await expect(page.locator('[data-toolbar-task-list]')).toHaveClass(/bg-blue-100/);

	await expect(taskItems(page)).toHaveCount(6);
	await expect(editor(page).locator('ul[data-type="taskList"] ul[data-type="taskList"] > li')).toHaveCount(2);

	await checkbox(page, 'Send the report').click();
	await checkbox(page, 'Attach the figures').click();
	await expect(checkbox(page, 'Send the report')).toBeChecked();

	const expectedList = ['- [ ] Call Jane about the budget', '- [x] Send the report', '  - [x] Attach the figures', '  - [ ] Check the totals', '- [ ] Book the review'].join('\n');
	const saved = await savedContent(page, noteId, expectedList);
	expect(saved).toContain('- [ ] Later');

	await page.reload();
	await sidebarContract(page, 'General').click();
	await noteListItem(page, firstLine).click();
	await expect(checkbox(page, 'Send the report')).toBeChecked();
	await expect(checkbox(page, 'Attach the figures')).toBeChecked();
	await expect(checkbox(page, 'Call Jane')).not.toBeChecked();
	await expect(checkbox(page, 'Check the totals')).not.toBeChecked();
	if (browserName === 'chromium') {
		await page.screenshot({ path: path.join(SCREENSHOTS, '01-nested-tasks-some-ticked.png') });
	}

	// PDF export prints each item as a box showing its state (the print frame's own document)
	if (browserName === 'chromium') {
		await page.getByRole('button', { name: /Export/ }).click();
		await page.getByRole('button', { name: 'Export as PDF' }).click();
		const printFrame = page.locator('iframe[data-note-print-frame]');
		await expect(printFrame).toHaveCount(1);
		const printedHtml = await printFrame.evaluate((frame) => (frame as HTMLIFrameElement).contentDocument!.documentElement.outerHTML);
		const boxes = await printFrame.evaluate((frame) =>
			Array.from((frame as HTMLIFrameElement).contentDocument!.querySelectorAll('.task-box')).map((box) => box.textContent)
		);
		expect(boxes).toEqual(['☐', '☑', '☑', '☐', '☐', '☐']);
		const printPage = await page.context().newPage();
		await printPage.setContent(printedHtml);
		await printPage.screenshot({ path: path.join(SCREENSHOTS, '03-pdf-export-boxes.png') });
		await printPage.close();
	}

	// unticking saves too
	await checkbox(page, 'Send the report').click();
	await savedContent(page, noteId, '- [ ] Send the report');
});

test('a CLI note written as markdown opens with checkboxes; chronolog todos lists its open items', async ({ page, baseURL, browserName }) => {
	const suffix = `${Date.now().toString(36)}${browserName.slice(0, 2)}`;
	await page.goto('/');
	const rawToken = await page.evaluate(async () => {
		const response = await fetch('/api/tokens', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'playwright 040' })
		});
		return (await response.json()).rawToken as string;
	});
	const environment = {
		CHRONOLOG_BASE_URL: baseURL!.replace(/\/+$/, ''),
		CHRONOLOG_API_TOKEN: rawToken,
		CHRONOLOG_CONFIG: path.join(mkdtempSync(path.join(tmpdir(), 'chronolog-pw-040-')), 'config.json')
	};
	const title = `Secretary actions ${suffix}`;
	const bodyFile = path.join(mkdtempSync(path.join(tmpdir(), 'chronolog-pw-040-body-')), 'body.md');
	writeFileSync(bodyFile, 'Agreed in the call:\n\n- [ ] Draft the proposal\n- [x] Share the deck\n  - [ ] Follow up with legal\n- context bullet\n');
	const created = await runCli(['note', 'new', 'General', title, '--file', bodyFile, '--json'], environment);
	expect(created.exitCode, created.stderr).toBe(0);
	const noteId = JSON.parse(created.stdout).id as string;

	await sidebarContract(page, 'General').click();
	await noteListItem(page, title).click();
	await expect(taskItems(page)).toHaveCount(3);
	await expect(checkbox(page, 'Share the deck')).toBeChecked();
	await expect(checkbox(page, 'Draft the proposal')).not.toBeChecked();
	await expect(editor(page).locator('ul:not([data-type]) > li', { hasText: 'context bullet' })).toBeVisible();
	if (browserName === 'chromium') {
		await page.screenshot({ path: path.join(SCREENSHOTS, '02-cli-note-opens-with-checkboxes.png') });
	}

	const todos = await runCli(['todos', 'General'], environment);
	expect(todos.exitCode, todos.stderr).toBe(0);
	expect(todos.stdout).toContain(`${noteId}  ${title}  Draft the proposal`);
	expect(todos.stdout).toContain(`${noteId}  ${title}    Follow up with legal`);
	expect(todos.stdout).not.toContain('Share the deck');

	// ticking in the browser takes the item off the CLI's list
	await checkbox(page, 'Draft the proposal').click();
	// `*` marker: a bullet list follows this task list, so the two stay separate lists
	await savedContent(page, noteId, '* [x] Draft the proposal');
	const after = await runCli(['todos', 'General', '--all'], environment);
	expect(after.stdout).toContain(`${noteId}  ${title}  [x] Draft the proposal`);
	expect(after.stdout).toContain(`${noteId}  ${title}  [x] Share the deck`);
});
