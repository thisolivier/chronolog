/**
 * Attachment URL resolver for Chronolog's custom `chronolog://` URL scheme.
 *
 * Images and PDFs embedded in notes use `chronolog://attachment/{uuid}` URLs.
 * This module resolves those URLs to displayable blob URLs by fetching the
 * binary data from the server API and creating object URLs.
 *
 * Exports:
 *   - parseChronologUrl(url) -- extract attachment ID from a chronolog:// URL
 *   - buildChronologUrl(attachmentId) -- build a chronolog:// URL from an ID
 *   - resolveAttachmentUrl(chronologUrl) -- fetch + create a blob URL
 *   - revokeAttachmentUrl(blobUrl) -- clean up a previously created blob URL
 *   - resolveAllChronologImages(container) -- scan DOM and resolve all chronolog:// img srcs
 *   - revokeAllTrackedUrls() -- clean up all tracked blob URLs
 */

const CHRONOLOG_PROTOCOL = 'chronolog://';
const ATTACHMENT_PREFIX = `${CHRONOLOG_PROTOCOL}attachment/`;

/** Cache of chronolog:// URL -> blob URL to avoid re-fetching. */
const resolvedUrlCache = new Map<string, string>();

/** Set of all blob URLs created by this module, for cleanup. */
const trackedBlobUrls = new Set<string>();

/**
 * Parse a `chronolog://attachment/{uuid}` URL and extract the attachment UUID.
 * Returns `null` if the URL does not match the expected format.
 */
export function parseChronologUrl(url: string): string | null {
	if (!url || !url.startsWith(ATTACHMENT_PREFIX)) {
		return null;
	}

	const attachmentId = url.slice(ATTACHMENT_PREFIX.length);

	if (!attachmentId || attachmentId.includes('/')) {
		return null;
	}

	return attachmentId;
}

/**
 * Build a `chronolog://attachment/{uuid}` URL from an attachment ID.
 */
export function buildChronologUrl(attachmentId: string): string {
	return `${ATTACHMENT_PREFIX}${attachmentId}`;
}

/**
 * Resolve a `chronolog://attachment/{uuid}` URL to a displayable blob URL.
 *
 * Fetches the attachment binary data from `/api/attachments/{id}`, creates
 * a blob URL via `URL.createObjectURL()`, and caches the result so
 * subsequent calls for the same chronolog URL return immediately.
 *
 * Returns `null` if the URL is invalid or the fetch fails.
 */
export async function resolveAttachmentUrl(chronologUrl: string): Promise<string | null> {
	// Return cached blob URL if already resolved
	const cachedBlobUrl = resolvedUrlCache.get(chronologUrl);
	if (cachedBlobUrl) {
		return cachedBlobUrl;
	}

	const attachmentId = parseChronologUrl(chronologUrl);
	if (!attachmentId) {
		return null;
	}

	try {
		const response = await fetch(`/api/attachments/${attachmentId}`);
		if (!response.ok) {
			console.error(`Failed to fetch attachment ${attachmentId}: ${response.status}`);
			return null;
		}

		const blobData = await response.blob();
		const blobUrl = URL.createObjectURL(blobData);

		resolvedUrlCache.set(chronologUrl, blobUrl);
		trackedBlobUrls.add(blobUrl);

		return blobUrl;
	} catch (fetchError) {
		console.error(`Error resolving attachment ${attachmentId}:`, fetchError);
		return null;
	}
}

/**
 * Revoke a blob URL previously created by `resolveAttachmentUrl`.
 * Also removes it from the cache so a future resolve will re-fetch.
 */
export function revokeAttachmentUrl(blobUrl: string): void {
	URL.revokeObjectURL(blobUrl);
	trackedBlobUrls.delete(blobUrl);

	// Remove from cache (find the chronolog URL that maps to this blob URL)
	for (const [chronologUrl, cachedBlobUrl] of resolvedUrlCache.entries()) {
		if (cachedBlobUrl === blobUrl) {
			resolvedUrlCache.delete(chronologUrl);
			break;
		}
	}
}

/**
 * Revoke all blob URLs tracked by this module.
 * Useful for cleanup when a component is destroyed.
 */
export function revokeAllTrackedUrls(): void {
	for (const blobUrl of trackedBlobUrls) {
		URL.revokeObjectURL(blobUrl);
	}
	trackedBlobUrls.clear();
	resolvedUrlCache.clear();
}

/**
 * Scan a DOM container for `<img>` elements with `chronolog://` src attributes
 * and replace them with resolved blob URLs.
 *
 * This is the pragmatic approach to rendering chronolog:// images in the
 * TipTap editor: after each editor update, call this function to resolve
 * any unresolved chronolog:// image sources.
 */
export async function resolveAllChronologImages(container: HTMLElement): Promise<void> {
	const imageElements = container.querySelectorAll<HTMLImageElement>('img[src^="chronolog://"]');

	const resolutionPromises = Array.from(imageElements).map(async (imageElement) => {
		const chronologSrc = imageElement.getAttribute('src');
		if (!chronologSrc) return;

		const blobUrl = await resolveAttachmentUrl(chronologSrc);
		if (blobUrl) {
			// Store the original chronolog URL as a data attribute for later reference
			imageElement.setAttribute('data-chronolog-src', chronologSrc);
			imageElement.setAttribute('src', blobUrl);
		}
	});

	await Promise.all(resolutionPromises);
}
