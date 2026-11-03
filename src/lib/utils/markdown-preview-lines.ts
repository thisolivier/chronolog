/**
 * First two non-empty text lines of a markdown note body, with heading, list and quote
 * markers stripped. The fallback preview for notes created over the API (CLI), which have
 * markdown `content` but no TipTap `contentJson` until first edited in the UI.
 */
export function extractMarkdownPreviewLines(markdown: string | null): {
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
		.filter((line) => line.length > 0 && !/^(-{3,}|\*{3,}|`{3,}.*)$/.test(line));
	return { firstLine: lines[0] ?? '', secondLine: lines[1] ?? '' };
}
