// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { ATTACHMENT_LINK_PROTOCOLS, openAttachment } from './attachment-link';
import { AttachmentLinkStatus, attachmentStatus, checkAttachment, forgetAttachmentStatuses } from './attachment-availability';

const DELETED_URL = 'chronolog://attachment/550e8400-e29b-41d4-a716-446655440001';
const LIVE_URL = 'chronolog://attachment/550e8400-e29b-41d4-a716-446655440002';

function stubHeadResponses() {
	const fetchStub = vi.fn(async (url: string, _init?: RequestInit) => new Response(null, { status: url.endsWith('0001') ? 404 : 200 }));
	vi.stubGlobal('fetch', fetchStub);
	return fetchStub;
}

afterEach(() => {
	vi.unstubAllGlobals();
	forgetAttachmentStatuses();
});

describe('attachment availability (sprint 043-CL)', () => {
	it('asks the server once per attachment and remembers the answer', async () => {
		const fetchStub = stubHeadResponses();
		expect(await checkAttachment(DELETED_URL)).toBe(false);
		expect(await checkAttachment(DELETED_URL)).toBe(false);
		expect(await checkAttachment(LIVE_URL)).toBe(true);
		expect(fetchStub).toHaveBeenCalledTimes(2);
		expect(fetchStub.mock.calls[0][1]).toMatchObject({ method: 'HEAD', cache: 'no-store' });
		expect(attachmentStatus(DELETED_URL)).toBe('missing');
	});

	it('does not open a tab for a known-missing attachment', async () => {
		stubHeadResponses();
		await checkAttachment(DELETED_URL);
		const opener = { open: vi.fn() };
		expect(await openAttachment(DELETED_URL, opener)).toBe(false);
		expect(opener.open).not.toHaveBeenCalled();
	});

	it('decorates only links to deleted attachments, without changing the document', async () => {
		stubHeadResponses();
		const editor = new Editor({
			extensions: [StarterKit.configure({ link: { openOnClick: false, protocols: ATTACHMENT_LINK_PROTOCOLS } }), Markdown, AttachmentLinkStatus],
			content: `[gone.pdf](${DELETED_URL}) and [here.pdf](${LIVE_URL})`
		});
		const updates = vi.fn();
		editor.on('update', updates);
		const jsonBefore = JSON.stringify(editor.getJSON());
		await vi.waitFor(() => expect(editor.view.dom.querySelectorAll('.attachment-link-missing')).toHaveLength(1));
		expect(editor.view.dom.querySelector('.attachment-link-missing')?.textContent).toBe('gone.pdf');
		expect(JSON.stringify(editor.getJSON())).toBe(jsonBefore);
		expect(updates).not.toHaveBeenCalled();
		editor.destroy();
	});
});
