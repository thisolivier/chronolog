/**
 * Extract the first two non-empty text lines from TipTap JSON content.
 * Walks doc.content[] blocks and extracts plain text.
 *
 * This is a pure utility with no server dependencies — usable on both
 * client and server.
 */
export function extractPreviewLines(contentJson: string | null): {
	firstLine: string;
	secondLine: string;
} {
	const empty = { firstLine: '', secondLine: '' };
	if (!contentJson) return empty;

	try {
		const doc = JSON.parse(contentJson);
		if (!doc.content || !Array.isArray(doc.content)) return empty;

		const lines: string[] = [];
		for (const block of doc.content) {
			if (lines.length >= 2) break;

			let blockText = '';
			if (block.content && Array.isArray(block.content)) {
				for (const node of block.content) {
					if (node.type === 'text' && node.text) {
						blockText += node.text;
					}
				}
			}

			const trimmed = blockText.trim();
			if (trimmed) {
				lines.push(trimmed);
			}
		}

		return {
			firstLine: lines[0] ?? '',
			secondLine: lines[1] ?? ''
		};
	} catch {
		return empty;
	}
}
