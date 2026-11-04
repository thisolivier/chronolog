/**
 * Note markdown helpers for `note new`, `note edit` and `note append` (sprint 034-CL).
 * A CLI note's markdown starts with `# <title>`; the app takes the first line as the title.
 */

import { readFileSync } from 'node:fs';

/** The body from `--file`, else from piped stdin, else '' (a terminal never blocks for input). */
export function readBody(flags, stdin = process.stdin) {
	if (flags.file) return readFileSync(flags.file, 'utf8');
	if (!stdin.isTTY) return readFileSync(0, 'utf8');
	return '';
}

const HEADING_LINE = /^#\s+(.*)$/;

/** The text of the first line when it is a level-one heading, else null. */
export function headingTitle(markdown) {
	const firstLine = (markdown ?? '').split('\n', 1)[0];
	const match = HEADING_LINE.exec(firstLine);
	return match ? match[1].trim() : null;
}

/** Puts `title` as the first-line heading: replaces an existing one, else adds one on top. */
export function withTitle(markdown, title) {
	const lines = (markdown ?? '').split('\n');
	if (HEADING_LINE.test(lines[0])) return [`# ${title}`, ...lines.slice(1)].join('\n');
	return `# ${title}\n\n${markdown ?? ''}`;
}

/**
 * The new markdown for `note edit`. A new body replaces everything; it keeps the note's title
 * heading unless the body starts with its own `# ` heading. `--title` then replaces the heading.
 */
export function editedContent(currentNote, { title, body }) {
	let content = currentNote.content ?? '';
	if (body !== undefined) {
		const currentTitle = headingTitle(content) ?? currentNote.title;
		content = headingTitle(body) !== null || !currentTitle ? body : `# ${currentTitle}\n\n${body}`;
	}
	if (title !== undefined) content = withTitle(content, title);
	return content.trimEnd() + '\n';
}

/** The markdown for `note append`: the old text, a blank line, the new text. */
export function appendedContent(currentContent, text) {
	const existing = (currentContent ?? '').trimEnd();
	return (existing ? `${existing}\n\n${text.trim()}` : text.trim()) + '\n';
}

/** Words in markdown with the syntax left out (the server's `calculateWordCountFromMarkdown`). */
export function countWords(markdown) {
	const plainText = (markdown ?? '')
		.replace(/^\s*(```|~~~).*$/gm, ' ')
		.replace(/^\s*([-*_]\s*){3,}$/gm, ' ')
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/^\s*(#{1,6}|>+|[-*+]\s+\[[ xX]\]|[-*+]|\d+[.)])\s+/gm, '')
		.replace(/[*_~`|]/g, ' ');
	return plainText.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}
