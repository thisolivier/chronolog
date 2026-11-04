/**
 * Non-image attachments (PDFs) sit in a note as ordinary links, `[report.pdf](chronolog://attachment/<id>)`
 * (sprint 036-CL). The Link mark only keeps hrefs whose scheme it knows, so the editor registers
 * `chronolog` through `ATTACHMENT_LINK_PROTOCOLS`. Clicking such a link opens the decrypted file
 * in a new tab through the same blob URL the image node view uses (`attachment-resolver.ts`):
 * the browser can never load `chronolog://` itself, and `/api/attachments/<id>` needs the session.
 */

import { parseChronologUrl, resolveAttachmentUrl } from './attachment-resolver.js';

/** Extra schemes for the Link mark (`StarterKit.configure({ link: { protocols } })`). */
export const ATTACHMENT_LINK_PROTOCOLS = ['chronolog'];

/** The `chronolog://attachment/<id>` href of the attachment link at or around `target`, else null. */
export function attachmentHrefFromTarget(target: EventTarget | null): string | null {
	if (!target || !(target as Element).closest) return null;
	const anchor = (target as Element).closest('a[href]');
	const href = anchor?.getAttribute('href') ?? '';
	return parseChronologUrl(href) ? href : null;
}

/**
 * Open the attachment behind a `chronolog://attachment/<id>` URL in a new tab. The tab is opened
 * before the fetch, inside the click, so a popup blocker lets it through; it is pointed at the
 * blob URL once the bytes arrive, and closed again if they never do. Resolves false on failure.
 */
export async function openAttachment(chronologUrl: string, opener: Pick<Window, 'open'> = window): Promise<boolean> {
	const newTab = opener.open('about:blank', '_blank');
	const blobUrl = await resolveAttachmentUrl(chronologUrl);
	if (!blobUrl) {
		newTab?.close();
		return false;
	}
	if (newTab) newTab.location.href = blobUrl;
	else opener.open(blobUrl, '_blank');
	return true;
}
