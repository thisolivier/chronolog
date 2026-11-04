// @vitest-environment jsdom
/**
 * Sprint 037-CL, browser side of the trash: the title cache asks for trashed notes and marks them,
 * the editor renders a link to one as "deleted", the inline restore prompt, and restoreTrashedNote.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { WikiLink } from './extensions/wiki-link';
import {
	_resetNoteTitleCache,
	getCachedNoteTitle,
	isNoteInTrash,
	rememberNoteTitle,
	requestNoteTitles,
	setNoteTrashed
} from './note-titles.svelte';
import { restoreTrashedNote, showRestorePrompt } from './note-trash';
import type { DataService } from '$lib/services/data-service';

const TRASHED_ID = 'ACME.20261104.001';
const LIVE_ID = 'ACME.20261104.002';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => _resetNoteTitleCache());
afterEach(() => {
	vi.unstubAllGlobals();
	document.body.innerHTML = '';
});

describe('title cache and trashed notes', () => {
	it('asks for trashed notes too and knows which are in the trash', async () => {
		const fetchMock = vi.fn(async () =>
			new Response(JSON.stringify({
				titles: [
					{ id: TRASHED_ID, displayTitle: 'Old plan', contractId: 'c', clientId: 'k', deletedAt: '2026-11-04T10:00:00Z' },
					{ id: LIVE_ID, displayTitle: 'Live', contractId: 'c', clientId: 'k', deletedAt: null }
				]
			}))
		);
		vi.stubGlobal('fetch', fetchMock);
		requestNoteTitles([TRASHED_ID, LIVE_ID]);
		await flush();
		await flush();
		expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('includeDeleted=1');
		expect(isNoteInTrash(TRASHED_ID)).toBe(true);
		expect(isNoteInTrash(LIVE_ID)).toBe(false);

		setNoteTrashed(TRASHED_ID, null);
		expect(isNoteInTrash(TRASHED_ID)).toBe(false);
		expect(getCachedNoteTitle(TRASHED_ID)?.displayTitle).toBe('Old plan');
	});
});

describe('wiki-link node view', () => {
	it('renders a link to a trashed note as deleted, and live again after a restore', () => {
		rememberNoteTitle(TRASHED_ID, { displayTitle: 'Old plan', contractId: 'c', clientId: 'k', deletedAt: '2026-11-04T10:00:00Z' });
		const element = document.createElement('div');
		document.body.append(element);
		const editor = new Editor({
			element,
			extensions: [StarterKit.configure({ link: false }), Markdown, WikiLink],
			content: `<p>See <span data-wiki-link="" data-note-id="${TRASHED_ID}" data-label="${TRASHED_ID}">x</span></p>`
		});
		const link = element.querySelector('[data-wiki-link]') as HTMLElement;
		expect(link.classList.contains('wiki-link-deleted')).toBe(true);
		expect(link.hasAttribute('data-deleted')).toBe(true);
		expect(link.textContent).toBe('Old plan');
		expect(link.title).toContain('deleted');

		setNoteTrashed(TRASHED_ID, null);
		expect(link.classList.contains('wiki-link-deleted')).toBe(false);
		editor.destroy();
	});
});

describe('restore prompt', () => {
	it('Restore runs the action and closes; a failure keeps it open with a message; Cancel closes', async () => {
		const anchor = document.createElement('button');
		document.body.append(anchor);
		const onRestore = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const prompt = showRestorePrompt(anchor, { title: 'Old plan', onRestore });
		expect(prompt.textContent).toContain('“Old plan” is in the trash.');

		const restoreButton = [...prompt.querySelectorAll('button')].find((button) => button.textContent === 'Restore')!;
		restoreButton.click();
		await flush();
		expect(document.body.contains(prompt)).toBe(true);
		expect(prompt.textContent).toContain('Could not restore');
		restoreButton.click();
		await flush();
		expect(onRestore).toHaveBeenCalledTimes(2);
		expect(document.body.contains(prompt)).toBe(false);

		const second = showRestorePrompt(anchor, { title: 'Old plan', onRestore });
		[...second.querySelectorAll('button')].find((button) => button.textContent === 'Cancel')!.click();
		expect(document.body.contains(second)).toBe(false);
	});
});

describe('restoreTrashedNote', () => {
	it('restores through the data service, marks the note live and announces note-restored', async () => {
		rememberNoteTitle(TRASHED_ID, { displayTitle: 'Old plan', contractId: 'c1', clientId: 'k1', deletedAt: '2026-11-04T10:00:00Z' });
		const restoreNote = vi.fn(async () => ({
			note: { id: TRASHED_ID, contractId: 'c1', title: 'Old plan', contentJson: null },
			contract: null
		}));
		const events: unknown[] = [];
		const listener = (event: Event) => events.push((event as CustomEvent).detail);
		window.addEventListener('note-restored', listener);
		await restoreTrashedNote({ restoreNote } as unknown as DataService, TRASHED_ID);
		window.removeEventListener('note-restored', listener);
		expect(restoreNote).toHaveBeenCalledWith(TRASHED_ID);
		expect(isNoteInTrash(TRASHED_ID)).toBe(false);
		expect(events).toEqual([{ noteId: TRASHED_ID, contractId: 'c1' }]);
	});
});
