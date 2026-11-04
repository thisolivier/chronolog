/**
 * Sprint 043-CL: notes and editor follow-ups. The trash page lists trashed notes with the days
 * left and restores them; previews and titles show link text (attachment links, wiki-links read as
 * the target's title); a link to a deleted attachment looks missing and opens nothing; on a phone
 * the Undo toast outlives the editor panel, linked time entries stay on one line, and in landscape
 * the linked panels start collapsed so the editor keeps the screen; toolbar buttons follow the
 * selection. Screenshots go to `docs/review/screenshots/sprint-043/` (chromium).
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { editor, noteListItem, openNoteId } from './notes-helpers';
import { sprintScreenshotDirectory } from './sprint-screenshots';

const SCREENSHOTS = sprintScreenshotDirectory('sprint-043');
const PHONE = { width: 390, height: 844 };

type Seeded = { contractId: string; clientId: string; contractName: string };

/** A fresh contract under the user's first client, through the API */
async function seedContract(page: Page, name: string): Promise<Seeded> {
	return page.evaluate(async (contractName) => {
		const contracts = await (await fetch('/api/contracts')).json();
		const response = await fetch('/api/contracts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ clientId: contracts[0].clientId, name: contractName, isActive: true })
		});
		const created = await response.json();
		const contract = created.contract ?? created;
		return { contractId: contract.id, clientId: contracts[0].clientId, contractName };
	}, name);
}

/** Create a note over the API (markdown, as the CLI does); returns its ID */
async function apiNote(page: Page, contractId: string, content: string, title?: string): Promise<string> {
	return page.evaluate(
		async ({ contractId, content, title }) => {
			const response = await fetch('/api/notes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contractId, content, ...(title ? { title } : {}) })
			});
			return (await response.json()).note.id as string;
		},
		{ contractId, content, title }
	);
}

async function deleteOpenNote(page: Page) {
	await page.getByTestId('note-editor-header').getByRole('button', { name: 'Delete' }).click();
	await page.getByTestId('delete-confirm').getByRole('button', { name: 'Delete' }).click();
}

const shoot = (page: Page, browserName: string, name: string) =>
	browserName === 'chromium' ? page.screenshot({ path: path.join(SCREENSHOTS, name) }) : Promise.resolve();

test('the trash page lists a deleted note with the days left and restores it', async ({ page, browserName }) => {
	const suffix = `${Date.now().toString(36)}${browserName.slice(0, 2)}`;
	await page.goto('/');
	const seeded = await seedContract(page, `Trash view ${suffix}`);
	const title = `Binned plan ${suffix}`;
	const noteId = await apiNote(page, seeded.contractId, `# ${title}\n\nTo be deleted.`);
	await page.goto(`/notes/${seeded.contractId}/${noteId}`);
	await expect(editor(page)).toContainText(title);
	await deleteOpenNote(page);
	await expect(noteListItem(page, title)).toHaveCount(0);

	// The sidebar's Trash entry opens /notes/trash; the row has its contract, date and days left
	await page.getByTestId('sidebar-trash-link').click();
	await expect(page).toHaveURL(/\/notes\/trash$/);
	const row = page.locator(`[data-testid="trash-row"][data-note-id="${noteId}"]`);
	await expect(row).toContainText(title);
	await expect(row).toContainText(seeded.contractName);
	await expect(row.getByTestId('trash-days-left')).toHaveText('30 days left');
	await shoot(page, browserName, '01-trash-view.png');

	// Reload keeps the page (the URL is the state); Restore, then Open lands on the note
	await page.reload();
	await expect(row).toBeVisible();
	await row.getByTestId('trash-restore').click();
	await expect(row).toContainText('Restored');
	await row.getByTestId('trash-open').click();
	await expect(editor(page)).toContainText(title);
	expect(await openNoteId(page)).toBe(noteId);
	await expect(noteListItem(page, title)).toBeVisible();

	// Gone from the trash
	await page.goto('/notes/trash');
	await expect(page.getByTestId('trash-list').or(page.getByTestId('trash-empty'))).toBeVisible();
	await expect(page.locator(`[data-testid="trash-row"][data-note-id="${noteId}"]`)).toHaveCount(0);
});

test('previews and titles show link text, not markdown or blanks', async ({ page, browserName }) => {
	const suffix = `${Date.now().toString(36)}${browserName.slice(0, 2)}`;
	await page.goto('/');
	const seeded = await seedContract(page, `Previews ${suffix}`);
	const alphaTitle = `Alpha note ${suffix}`;
	const alphaId = await apiNote(page, seeded.contractId, `# ${alphaTitle}\n\nThe plan.`);
	const fileId = '550e8400-e29b-41d4-a716-446655440000';
	await apiNote(page, seeded.contractId, `# Filed ${suffix}\n[statement.pdf](chronolog://attachment/${fileId}) signed`);
	await apiNote(page, seeded.contractId, `Beta ${suffix} links to [[${alphaId}]]\n\nSee [[${alphaId}|the plan]].`);

	await page.goto(`/notes/${seeded.contractId}`);
	// Attachment link: its filename, not `[statement.pdf](chronolog://…`
	const filedRow = noteListItem(page, `Filed ${suffix}`);
	await expect(filedRow).toContainText('statement.pdf signed');
	await expect(filedRow).not.toContainText('chronolog://');
	// Wiki-links: the target's title, or the link's own label
	const betaRow = noteListItem(page, `Beta ${suffix} links to ${alphaTitle}`);
	await expect(betaRow).toBeVisible();
	await expect(betaRow).toContainText('See the plan.');
	await shoot(page, browserName, '02-previews-link-text.png');

	// Edited in the browser, the saved title keeps the link text too
	await betaRow.click();
	await expect(editor(page).locator(`[data-note-id="${alphaId}"]`).first()).toHaveText(alphaTitle);
	await editor(page).click();
	await page.keyboard.press('ControlOrMeta+End');
	await page.keyboard.type(' Edited.');
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10000 });
	const savedTitle = await page.evaluate(async (id) => (await (await fetch(`/api/notes/${id}`)).json()).note.title, await openNoteId(page));
	expect(savedTitle).toBe(`Beta ${suffix} links to ${alphaTitle}`);
});

test('a link to a deleted attachment looks missing and opens no tab', async ({ page, context, browserName }) => {
	const suffix = `${Date.now().toString(36)}${browserName.slice(0, 2)}`;
	await page.goto('/');
	const seeded = await seedContract(page, `Files ${suffix}`);
	const noteId = await apiNote(page, seeded.contractId, `# Files ${suffix}\n\nPlaceholder`);
	const { keptId, deletedId } = await page.evaluate(async (noteId) => {
		const upload = async (name: string) => {
			const form = new FormData();
			form.append('file', new Blob(['%PDF-1.4\n%%EOF\n'], { type: 'application/pdf' }), name);
			const response = await fetch(`/api/notes/${noteId}/attachments`, { method: 'POST', body: form });
			return (await response.json()).attachment.id as string;
		};
		return { keptId: await upload('kept.pdf'), deletedId: await upload('gone.pdf') };
	}, noteId);
	await page.evaluate(
		async ({ noteId, keptId, deletedId, suffix }) => {
			const content = `# Files ${suffix}\n\nKeep [kept.pdf](chronolog://attachment/${keptId}) and [gone.pdf](chronolog://attachment/${deletedId}).`;
			await fetch(`/api/notes/${noteId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
			await fetch(`/api/attachments/${deletedId}`, { method: 'DELETE' });
		},
		{ noteId, keptId, deletedId, suffix }
	);

	await page.goto(`/notes/${seeded.contractId}/${noteId}`);
	const goneLink = editor(page).locator(`a[href="chronolog://attachment/${deletedId}"]`);
	const keptLink = editor(page).locator(`a[href="chronolog://attachment/${keptId}"]`);
	await expect(goneLink.locator('.attachment-link-missing')).toBeVisible();
	await expect(keptLink).toBeVisible();
	await expect(keptLink.locator('.attachment-link-missing')).toHaveCount(0);
	await shoot(page, browserName, '03-deleted-attachment-link.png');

	// Clicking the missing one opens nothing; the note is not edited by the check
	let openedPages = 0;
	context.on('page', () => (openedPages += 1));
	await goneLink.click();
	await page.waitForTimeout(500);
	expect(openedPages).toBe(0);
	await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
});

test('phone: Undo after a delete works once the editor panel has gone', async ({ page, browserName }) => {
	await page.setViewportSize(PHONE);
	const suffix = `${Date.now().toString(36)}${browserName.slice(0, 2)}`;
	await page.goto('/');
	const seeded = await seedContract(page, `Phone undo ${suffix}`);
	const title = `Phone note ${suffix}`;
	const noteId = await apiNote(page, seeded.contractId, `# ${title}\n\nWritten on the train.`);
	await page.goto(`/notes/${seeded.contractId}/${noteId}`);
	await expect(editor(page)).toContainText(title);

	await deleteOpenNote(page);
	// The phone is back on the list: the editor panel is unmounted, the toast is still there
	await expect(page).toHaveURL(new RegExp(`/notes/${seeded.contractId}$`));
	await expect(editor(page)).toHaveCount(0);
	const toast = page.getByTestId('note-trash-toast');
	await expect(toast).toContainText('Moved to trash.');
	await shoot(page, browserName, '04-phone-undo-toast.png');

	await toast.getByRole('button', { name: 'Undo' }).click();
	await expect(toast).toHaveCount(0);
	await expect(editor(page)).toContainText(title);
	expect(await openNoteId(page)).toBe(noteId);
});

test('phone: linked time entries on one line; landscape keeps the editor big', async ({ page, browserName }) => {
	await page.setViewportSize({ width: 320, height: 700 });
	const suffix = `${Date.now().toString(36)}${browserName.slice(0, 2)}`;
	await page.goto('/');
	const seeded = await seedContract(page, `Linked ${suffix}`);
	const noteId = await apiNote(page, seeded.contractId, `# Linked ${suffix}\n\nWork log.`);
	await page.evaluate(
		async ({ contractId, noteId }) => {
			for (const date of ['2026-11-03', '2026-11-04']) {
				await fetch('/api/time-entries', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ contractId, date, startTime: '09:00', durationMinutes: 135, description: `Long working session on the design with [[${noteId}]] open` })
				});
			}
		},
		{ contractId: seeded.contractId, noteId }
	);
	await page.goto(`/notes/${seeded.contractId}/${noteId}`);
	const firstEntry = page.getByTestId('linked-time-entry').first();
	await firstEntry.scrollIntoViewIfNeeded();
	const dateBox = await page.getByTestId('linked-time-entry-date').first().boundingBox();
	const durationBox = await page.getByTestId('linked-time-entry-duration').first().boundingBox();
	expect(dateBox && durationBox).toBeTruthy();
	// One line, and it ends before the duration starts
	expect(dateBox!.height).toBeLessThan(20);
	expect(dateBox!.x + dateBox!.width).toBeLessThanOrEqual(durationBox!.x);
	await shoot(page, browserName, '05-phone-linked-entries.png');

	// Landscape phone: the linked panels start collapsed and the editor gets at least half the height
	await page.setViewportSize({ width: 844, height: 390 });
	const linkedPanels = page.getByTestId('note-linked-panels');
	await expect(linkedPanels).toBeVisible();
	await expect(linkedPanels).not.toHaveAttribute('open', '');
	const editorBox = await page.locator('[data-note-editor-content]').boundingBox();
	const visibleEditorHeight = Math.min(390, editorBox!.y + editorBox!.height) - Math.max(0, editorBox!.y);
	expect(visibleEditorHeight).toBeGreaterThanOrEqual(390 / 2);
	await shoot(page, browserName, '06-phone-landscape-editor.png');
	await linkedPanels.locator('summary').click();
	await expect(page.getByTestId('linked-time-entries')).toBeVisible();
});

test('toolbar buttons are disabled where they cannot apply, and enabled again', async ({ page, browserName }) => {
	const suffix = `${Date.now().toString(36)}${browserName.slice(0, 2)}`;
	await page.goto('/');
	const seeded = await seedContract(page, `Toolbar ${suffix}`);
	const noteId = await apiNote(page, seeded.contractId, `Toolbar ${suffix}\n\n\`\`\`\ncode here\n\`\`\``);
	await page.goto(`/notes/${seeded.contractId}/${noteId}`);
	const boldButton = page.getByTitle('Bold (⌘B)');
	await editor(page).locator('p', { hasText: `Toolbar ${suffix}` }).click();
	await expect(boldButton).toBeEnabled();
	// In a code block marks cannot apply: Bold goes disabled without any other change
	await editor(page).locator('pre').click();
	await expect(boldButton).toBeDisabled();
	await editor(page).locator('p', { hasText: `Toolbar ${suffix}` }).click();
	await expect(boldButton).toBeEnabled();
});
