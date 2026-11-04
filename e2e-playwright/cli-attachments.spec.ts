/**
 * Sprint 036-CL task 5: a PDF attached by `chronolog note attach` shows in the editor as a link with
 * a document icon and in the attachment list with its size, and both open the file in a new tab
 * (a blob URL of the decrypted bytes).
 */
import { test, expect, type Download, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { editor, noteListItem, sidebarContract, createNote } from './notes-helpers';
import { minimalPdf } from '../src/e2e/attachment-fixtures';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const CURRENT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(CURRENT_DIRECTORY, '..', 'cli', 'chronolog.mjs');
const SCREENSHOT_DIRECTORY = sprintScreenshotDirectory('sprint-036');

function runCli(args: string[], environment: Record<string, string>) {
	return new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
		execFile(process.execPath, [CLI_PATH, ...args, '--json'], { env: { ...process.env, ...environment } }, (error, stdout, stderr) =>
			resolve({ exitCode: error ? Number(error.code ?? 1) : 0, stdout, stderr })
		);
	});
}

/**
 * Click, then check the new tab received the PDF as a blob URL. A headed browser shows it in its
 * viewer; headless Chromium has no PDF viewer and turns that navigation into a download of the same
 * blob (often before `waitForEvent('page')` returns, hence the listener set up before the click),
 * so either outcome proves the tab received the decrypted file.
 */
async function clickAndExpectPdfTab(page: Page, click: () => Promise<void>, expectedBytes: number) {
	let download: Download | null = null;
	page.context().once('page', (tab) => tab.once('download', (started) => (download = started)));
	const [tab] = await Promise.all([page.context().waitForEvent('page'), click()]);
	await expect.poll(() => (download ? 'download' : tab.url().startsWith('blob:') ? 'blob' : tab.url()), { timeout: 10000 }).toMatch(/^(download|blob)$/);
	const downloaded = download as Download | null;
	if (downloaded) {
		expect(downloaded.url()).toMatch(/^blob:/);
		const savedPath = await downloaded.path();
		expect(statSync(savedPath).size).toBe(expectedBytes);
		expect(readFileSync(savedPath).subarray(0, 5).toString()).toBe('%PDF-');
	} else {
		const blobType = await tab.evaluate(async () => (await (await fetch(location.href)).blob()).type);
		expect(blobType).toBe('application/pdf');
	}
	await tab.close();
}

test('a PDF attached by the CLI is a link in the editor and a sized row in the list; both open it', async ({ page, baseURL, browserName }) => {
	const suffix = `${Date.now().toString(36)}${browserName.slice(0, 2)}`;
	const firstLine = `Filing a PDF ${suffix}`;

	await page.goto('/');
	await sidebarContract(page, 'General').click();
	const noteId = await createNote(page, firstLine);

	const rawToken = await page.evaluate(async () => {
		const response = await fetch('/api/tokens', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'playwright 036' })
		});
		return (await response.json()).rawToken as string;
	});
	const workDirectory = mkdtempSync(path.join(tmpdir(), 'chronolog-pw-036-'));
	const pdfBytes = minimalPdf(`Statement of work ${suffix}`);
	const pdfPath = path.join(workDirectory, 'Statement of work.pdf');
	writeFileSync(pdfPath, pdfBytes);
	const environment = {
		CHRONOLOG_BASE_URL: baseURL!.replace(/\/+$/, ''),
		CHRONOLOG_API_TOKEN: rawToken,
		CHRONOLOG_CONFIG: path.join(workDirectory, 'config.json')
	};
	const attach = await runCli(['note', 'attach', noteId, pdfPath], environment);
	expect(attach.exitCode, attach.stderr).toBe(0);
	const attachmentId = JSON.parse(attach.stdout).attachment.id as string;

	await page.reload();
	await sidebarContract(page, 'General').click();
	await noteListItem(page, firstLine).click();

	const pdfLink = editor(page).locator(`a[href="chronolog://attachment/${attachmentId}"]`);
	await expect(pdfLink).toHaveText('Statement of work.pdf');
	await expect(editor(page).locator('img')).toHaveCount(0);

	const listRow = page.getByTestId('attachment-item').filter({ hasText: 'Statement of work.pdf' });
	await expect(listRow).toHaveAttribute('data-mime-type', 'application/pdf');
	await expect(listRow.getByLabel('Document')).toBeVisible();
	const expectedSize = pdfBytes.length < 1024 ? `${pdfBytes.length} B` : `${(pdfBytes.length / 1024).toFixed(1)} KB`;
	await expect(listRow.getByTestId('attachment-size')).toHaveText(expectedSize);

	if (browserName === 'chromium') {
		await page.screenshot({ path: path.join(SCREENSHOT_DIRECTORY, '01-editor-pdf-link-and-attachment-list.png') });
		await listRow.screenshot({ path: path.join(SCREENSHOT_DIRECTORY, '02-attachment-list-row.png') });
	}

	// Clicking the link in the editor opens the decrypted PDF in a new tab
	await clickAndExpectPdfTab(page, () => pdfLink.click(), pdfBytes.length);

	// The editor did not navigate and the note text is unchanged
	await expect(pdfLink).toBeVisible();

	// So does the filename in the attachment list
	await clickAndExpectPdfTab(page, () => listRow.getByRole('button', { name: 'Statement of work.pdf' }).click(), pdfBytes.length);
});

test('the Attach button takes a PDF and inserts it as a link, not an image', async ({ page, browserName }) => {
	const suffix = `${Date.now().toString(36)}${browserName.slice(0, 2)}`;
	await page.goto('/');
	await sidebarContract(page, 'General').click();
	const noteId = await createNote(page, `Attach button ${suffix}`);
	await page.keyboard.press('Enter');

	const pdfBytes = minimalPdf(`Proposal ${suffix}`);
	await page.locator('input[type="file"][accept*="application/pdf"]').setInputFiles({ name: 'Proposal.pdf', mimeType: 'application/pdf', buffer: pdfBytes });

	const pdfLink = editor(page).locator('a[href^="chronolog://attachment/"]');
	await expect(pdfLink).toHaveText('Proposal.pdf');
	await expect(editor(page).locator('img')).toHaveCount(0);
	await expect(page.getByTestId('attachment-item').filter({ hasText: 'Proposal.pdf' })).toHaveAttribute('data-mime-type', 'application/pdf');

	// Typing after the link does not extend it, and the saved markdown carries the link
	await page.keyboard.type('signed');
	await expect(pdfLink).toHaveText('Proposal.pdf');
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10000 });
	const saved = await page.evaluate(async (id) => (await (await fetch(`/api/notes/${id}`)).json()).note.content as string, noteId);
	expect(saved).toMatch(/\[Proposal\.pdf\]\(chronolog:\/\/attachment\/[0-9a-f-]{36}\) ?signed/);
});
