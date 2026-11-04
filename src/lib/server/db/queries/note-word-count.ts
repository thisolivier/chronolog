/**
 * Word counts for `notes.word_count`. The browser saves TipTap JSON and the count comes from its
 * text nodes; a note written as markdown only (the CLI, sprint 034-CL) is counted from the
 * markdown with its syntax stripped, so both give the same answer for the same text.
 */

export function calculateWordCountFromJson(contentJson: string): number {
	try {
		const content = JSON.parse(contentJson);
		if (!content.content || !Array.isArray(content.content)) {
			return 0;
		}

		let wordCount = 0;
		for (const block of content.content) {
			if (block.content && Array.isArray(block.content)) {
				for (const node of block.content) {
					if (node.type === 'text' && node.text) {
						wordCount += node.text.split(/\s+/).filter((word: string) => word.length > 0).length;
					}
				}
			}
		}
		return wordCount;
	} catch {
		return 0;
	}
}

/** Words in markdown text: headings, list markers, emphasis, link targets and fences don't count. */
export function calculateWordCountFromMarkdown(markdown: string): number {
	const plainText = markdown
		.replace(/^\s*(```|~~~).*$/gm, ' ') // code fence lines
		.replace(/^\s*([-*_]\s*){3,}$/gm, ' ') // horizontal rules
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images keep their alt text
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links keep their text
		.replace(/^\s*(#{1,6}|>+|[-*+]\s+\[[ xX]\]|[-*+]|\d+[.)])\s+/gm, '') // block markers
		.replace(/[*_~`|]/g, ' ');
	return plainText.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}
