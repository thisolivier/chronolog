import { wikiLinkPlainText, type PreviewTextOptions } from './wiki-link-text';

type JsonNode = { type?: string; text?: string; attrs?: Record<string, unknown>; content?: JsonNode[] };

/**
 * Extract the first two non-empty text lines from TipTap JSON content. Every text block
 * (paragraph, heading, list item paragraph…) is one line; a wiki-link reads as its label, the
 * target's title (`options.resolveNoteTitle`) or the note ID (sprint 043-CL); a hard break is a space.
 *
 * This is a pure utility with no server dependencies — usable on both
 * client and server.
 */
export function extractPreviewLines(
	contentJson: string | null,
	options: PreviewTextOptions = {}
): {
	firstLine: string;
	secondLine: string;
} {
	const empty = { firstLine: '', secondLine: '' };
	if (!contentJson) return empty;

	try {
		const doc = JSON.parse(contentJson) as JsonNode;
		if (!doc.content || !Array.isArray(doc.content)) return empty;

		const lines: string[] = [];
		const collectLines = (blocks: JsonNode[]) => {
			for (const block of blocks) {
				if (lines.length >= 2) return;
				if (!Array.isArray(block.content)) continue;
				if (block.content.some(isInlineNode)) {
					const trimmed = inlineText(block.content, options).trim();
					if (trimmed) lines.push(trimmed);
				} else {
					collectLines(block.content);
				}
			}
		};
		collectLines(doc.content);

		return {
			firstLine: lines[0] ?? '',
			secondLine: lines[1] ?? ''
		};
	} catch {
		return empty;
	}
}

function isInlineNode(node: JsonNode): boolean {
	return node.type === 'text' || node.type === 'wikiLink' || node.type === 'hardBreak';
}

function inlineText(nodes: JsonNode[], options: PreviewTextOptions): string {
	let text = '';
	for (const node of nodes) {
		if (node.type === 'text' && node.text) text += node.text;
		else if (node.type === 'hardBreak') text += ' ';
		else if (node.type === 'wikiLink' && typeof node.attrs?.noteId === 'string') {
			text += wikiLinkPlainText(node.attrs.noteId, node.attrs.label as string | null | undefined, options);
		}
	}
	return text;
}
