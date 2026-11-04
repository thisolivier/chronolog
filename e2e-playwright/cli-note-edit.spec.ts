/**
 * Sprint 034-CL task 1: a note typed in the browser (markdown and TipTap JSON saved together),
 * then rewritten by `chronolog note edit` (markdown only), opens in the editor showing the CLI's
 * text, not the stale TipTap document.
 */
import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { editor, noteListItem, sidebarContract, createNote } from './notes-helpers';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const CURRENT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(CURRENT_DIRECTORY, '..', 'cli', 'chronolog.mjs');

function runCli(args: string[], environment: Record<string, string>, stdinText = '') {
	return new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
		const child = execFile(process.execPath, [CLI_PATH, ...args, '--json'], { env: { ...process.env, ...environment } }, (error, stdout, stderr) =>
			resolve({ exitCode: error ? Number(error.code ?? 1) : 0, stdout, stderr })
		);
		child.stdin?.end(stdinText);
	});
}

test('a note edited by the CLI after the browser opens with the CLI text', async ({ page, baseURL, browserName }) => {
	const suffix = `${Date.now().toString(36)}${browserName.slice(0, 2)}`;
	const browserLine = `Browser draft ${suffix}`;

	await page.goto('/');
	await sidebarContract(page, 'General').click();
	const noteId = await createNote(page, browserLine);
	await page.keyboard.press('Enter');
	await page.keyboard.type('A second paragraph typed in the browser.');
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10000 });
	const saved = await page.evaluate(async (id) => (await (await fetch(`/api/notes/${id}`)).json()).note, noteId);
	expect(saved.contentJson).toBeTruthy();

	const rawToken = await page.evaluate(async () => {
		const response = await fetch('/api/tokens', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'playwright 034' })
		});
		return (await response.json()).rawToken as string;
	});
	const environment = {
		CHRONOLOG_BASE_URL: baseURL!.replace(/\/+$/, ''),
		CHRONOLOG_API_TOKEN: rawToken,
		CHRONOLOG_CONFIG: path.join(mkdtempSync(path.join(tmpdir(), 'chronolog-pw-034-')), 'config.json')
	};
	const cliTitle = `Rewritten by the CLI ${suffix}`;
	const edit = await runCli(['note', 'edit', noteId, '--title', cliTitle], environment, '## Done\n- The secretary replaced this text.\n');
	expect(edit.exitCode, edit.stderr).toBe(0);

	await page.reload();
	await sidebarContract(page, 'General').click();
	await noteListItem(page, cliTitle).click();
	await expect(editor(page)).toContainText(cliTitle);
	await expect(editor(page)).toContainText('The secretary replaced this text.');
	await expect(editor(page)).not.toContainText('typed in the browser');
	await expect(editor(page).locator('h2')).toHaveText('Done');
	if (browserName === 'chromium') {
		await page.screenshot({ path: path.join(sprintScreenshotDirectory('sprint-034'), '01-editor-shows-cli-edit.png') });
	}
});
