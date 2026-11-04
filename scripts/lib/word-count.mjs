// Word counts for `notes.word_count`, a plain-JS copy of
// src/lib/server/db/queries/note-word-count.ts for scripts that run inside the production
// container (sprint 037-CL). scripts/lib/script-lib.test.ts checks both give the same counts.

/** Words in the text nodes of a TipTap document's top-level blocks (as the app counts them). */
export function calculateWordCountFromJson(contentJson) {
	try {
		const content = JSON.parse(contentJson);
		if (!content.content || !Array.isArray(content.content)) return 0;
		let wordCount = 0;
		for (const block of content.content) {
			if (block.content && Array.isArray(block.content)) {
				for (const node of block.content) {
					if (node.type === 'text' && node.text) {
						wordCount += node.text.split(/\s+/).filter((word) => word.length > 0).length;
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
export function calculateWordCountFromMarkdown(markdown) {
	const plainText = String(markdown ?? '')
		.replace(/^\s*(```|~~~).*$/gm, ' ')
		.replace(/^\s*([-*_]\s*){3,}$/gm, ' ')
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/^\s*(#{1,6}|>+|[-*+]\s+\[[ xX]\]|[-*+]|\d+[.)])\s+/gm, '')
		.replace(/[*_~`|]/g, ' ');
	return plainText.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** The app's rule: from the TipTap JSON when there is one, else from the markdown. */
export function noteWordCount(content, contentJson) {
	return contentJson ? calculateWordCountFromJson(contentJson) : calculateWordCountFromMarkdown(content ?? '');
}
