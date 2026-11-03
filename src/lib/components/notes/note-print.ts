/**
 * PDF export: print the note on its own from a hidden same-origin iframe.
 *
 * Printing the app page itself drags the layout along: chrome has to be hidden with print
 * CSS, and a print width under the mobile breakpoint remounts the editor so the PDF read
 * "Loading note…". Instead the rendered note HTML (titles and images already resolved) is
 * copied into a standalone document with its own print styles, images are awaited, and
 * only that iframe is printed.
 */

const PRINT_FRAME_ATTRIBUTE = 'data-note-print-frame';
const IMAGE_WAIT_TIMEOUT_MS = 5000;
const FRAME_CLEANUP_DELAY_MS = 60_000;

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

const PRINT_STYLES = `
	@page { size: A4; margin: 2cm; }
	html, body { margin: 0; padding: 0; background: white; }
	body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; color: black; }
	header.note-print-header { font-family: system-ui, sans-serif; font-size: 8pt; color: #666; margin-bottom: 1.5em; border-bottom: 1px solid #ccc; padding-bottom: 0.4em; }
	h1 { font-size: 20pt; line-height: 1.25; margin: 0 0 0.5em; page-break-after: avoid; }
	h2 { font-size: 16pt; line-height: 1.3; margin: 1em 0 0.4em; page-break-after: avoid; }
	h3 { font-size: 13pt; margin: 1em 0 0.4em; page-break-after: avoid; }
	p { margin: 0.4em 0; orphans: 3; widows: 3; }
	ul, ol { padding-left: 1.5em; margin: 0.4em 0; }
	ul { list-style-type: disc; }
	ul ul { list-style-type: circle; }
	ol { list-style-type: decimal; }
	ol ol { list-style-type: lower-alpha; }
	li > p { margin: 0; }
	pre { background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 4px; padding: 0.75em 1em; font-size: 9pt; white-space: pre-wrap; word-wrap: break-word; page-break-inside: avoid; }
	code { font-family: 'SFMono-Regular', Consolas, Menlo, monospace; font-size: 0.9em; }
	pre code { font-size: 9pt; }
	blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1em; color: #333; }
	img { max-width: 100%; height: auto; page-break-inside: avoid; }
	img.attachment-missing { display: none; }
	a { color: black; text-decoration: underline; }
	a[href^="http"]::after { content: ' (' attr(href) ')'; font-size: 0.8em; color: #666; }
	.wiki-link { color: black; font-weight: 600; }
	hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
	.hljs-comment { color: #6a737d; font-style: italic; }
	.hljs-keyword, .hljs-type { color: #d73a49; }
	.hljs-string { color: #032f62; }
	.hljs-number, .hljs-literal, .hljs-attr { color: #005cc5; }
	.hljs-title, .hljs-function { color: #6f42c1; }
`;

/** Build the standalone HTML document that gets printed. Pure, for tests. */
export function buildPrintDocument(options: { title: string; noteId: string; bodyHtml: string }): string {
	const documentTitle = escapeHtml(options.title || options.noteId);
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${documentTitle}</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
<header class="note-print-header">${escapeHtml(options.noteId)}</header>
<main class="note-print-body">${options.bodyHtml}</main>
</body>
</html>`;
}

/** Strip editor-only attributes from a copy of the editor DOM. */
function cleanEditorHtml(editorRoot: HTMLElement): string {
	const copy = editorRoot.cloneNode(true) as HTMLElement;
	copy.querySelectorAll('[contenteditable]').forEach((element) => element.removeAttribute('contenteditable'));
	copy.querySelectorAll('.ProseMirror-trailingBreak, .ProseMirror-separator').forEach((element) => element.remove());
	copy.querySelectorAll('p.is-editor-empty').forEach((element) => element.remove());
	return copy.innerHTML;
}

function waitForImages(frameDocument: Document): Promise<void> {
	const pendingImages = Array.from(frameDocument.images).filter((image) => !image.complete);
	if (pendingImages.length === 0) return Promise.resolve();
	const allLoaded = Promise.all(
		pendingImages.map(
			(image) =>
				new Promise<void>((resolve) => {
					image.addEventListener('load', () => resolve(), { once: true });
					image.addEventListener('error', () => resolve(), { once: true });
				})
		)
	).then(() => undefined);
	const timeout = new Promise<void>((resolve) => setTimeout(resolve, IMAGE_WAIT_TIMEOUT_MS));
	return Promise.race([allLoaded, timeout]);
}

/**
 * Print the rendered note in `editorRoot` (the TipTap `.tiptap` element).
 * Resolves once the print dialog has been opened.
 */
export async function printNote(options: { title: string; noteId: string; editorRoot: HTMLElement }): Promise<void> {
	document.querySelectorAll(`iframe[${PRINT_FRAME_ATTRIBUTE}]`).forEach((frame) => frame.remove());

	const frame = document.createElement('iframe');
	frame.setAttribute(PRINT_FRAME_ATTRIBUTE, '');
	frame.setAttribute('aria-hidden', 'true');
	frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
	document.body.appendChild(frame);

	const frameDocument = frame.contentDocument;
	const frameWindow = frame.contentWindow;
	if (!frameDocument || !frameWindow) throw new Error('Could not open the print frame');

	frameDocument.open();
	frameDocument.write(
		buildPrintDocument({
			title: options.title,
			noteId: options.noteId,
			bodyHtml: cleanEditorHtml(options.editorRoot)
		})
	);
	frameDocument.close();

	await waitForImages(frameDocument);

	frameWindow.focus();
	frameWindow.print();
	setTimeout(() => frame.remove(), FRAME_CLEANUP_DELAY_MS);
}
