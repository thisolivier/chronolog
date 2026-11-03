/**
 * Sanitize a string for use as a filename.
 */
export function sanitizeFilename(name: string): string {
	const sanitized = name
		.replace(/[/\\:*?"<>|]/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^[-\s]+|[-\s]+$/g, '')
		.slice(0, 100);

	return sanitized || 'untitled-note';
}

/**
 * Build the markdown content for export, prepending title if needed.
 */
export function buildMarkdownExportContent(title: string | null, content: string): string {
	if (title && title.trim() && !content.startsWith(`# ${title}\n`)) {
		return `# ${title}\n\n${content}`;
	}
	return content;
}

/**
 * Export a note as a downloadable Markdown file.
 */
export function exportAsMarkdown(title: string | null, content: string | null): void {
	if (!content) return;

	const exportContent = buildMarkdownExportContent(title, content);
	const blob = new Blob([exportContent], { type: 'text/markdown; charset=utf-8' });
	const filename = `${sanitizeFilename(title || 'untitled-note')}.md`;

	triggerDownload(blob, filename);
}

/**
 * Export a note as PDF using the browser's print dialog.
 * The @media print stylesheet handles hiding app chrome.
 */
export function exportAsPdf(): void {
	window.print();
}

/**
 * Trigger a file download via a temporary anchor element.
 */
function triggerDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	URL.revokeObjectURL(url);
}
