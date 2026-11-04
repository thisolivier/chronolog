import { markdownLinksToText, type PreviewTextOptions } from './wiki-link-text';

/**
 * First two non-empty text lines of a markdown note body, with heading, list and quote
 * markers stripped and links shown as their text (attachment links, wiki-links; sprint 043-CL).
 * The fallback preview for notes created over the API (CLI), which have
 * markdown `content` but no TipTap `contentJson` until first edited in the UI.
 */
export function extractMarkdownPreviewLines(
	markdown: string | null,
	options: PreviewTextOptions = {}
): {
	firstLine: string;
	secondLine: string;
} {
	const lines = (markdown ?? '')
		.split('\n')
		.map((line) =>
			line
				.replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '')
				.trim()
		)
		.filter((line) => line.length > 0 && !/^(-{3,}|\*{3,}|`{3,}.*)$/.test(line))
		.map((line) => markdownLinksToText(line, options).trim())
		.filter((line) => line.length > 0);
	return { firstLine: lines[0] ?? '', secondLine: lines[1] ?? '' };
}
