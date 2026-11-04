/**
 * Checkbox task items in a note's markdown (sprint 040-CL): `- [ ] open`, `- [x] done`, nested by
 * indentation. Used by `GET /api/notes/todos`. Markdown is the source because every save carries it
 * (the editor writes markdown and JSON together; the CLI writes markdown only), so it is never stale.
 * Lines inside fenced code blocks and empty items are ignored.
 */

export interface TaskItem {
	/** The item's text with markdown backslash escapes removed (`\*` → `*`); wiki-links stay `[[id]]`. */
	text: string;
	checked: boolean;
	/** 0 for a top-level item, 1 for an item nested one list deeper, … */
	depth: number;
	/** 1-based line number in the markdown */
	line: number;
}

const FENCE_PATTERN = /^\s*(```|~~~)/;
const TASK_LINE_PATTERN = /^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX])\](?:\s+(.*))?$/;
const MARKDOWN_ESCAPE_PATTERN = /\\([\\`*_{}[\]()#+\-.!<>~|])/g;

export function extractTaskItems(markdown: string | null | undefined): TaskItem[] {
	const items: TaskItem[] = [];
	// indentation of each open nesting level, to turn columns into depths
	const indentStack: number[] = [];
	let insideFence = false;
	const lines = String(markdown ?? '').split('\n');

	lines.forEach((lineText, index) => {
		if (FENCE_PATTERN.test(lineText)) {
			insideFence = !insideFence;
			return;
		}
		if (insideFence) return;
		const match = TASK_LINE_PATTERN.exec(lineText);
		if (!match) return;
		const text = (match[3] ?? '').replace(MARKDOWN_ESCAPE_PATTERN, '$1').trim();
		if (!text) return;

		const indent = match[1].replace(/\t/g, '    ').length;
		while (indentStack.length && indentStack[indentStack.length - 1] > indent) indentStack.pop();
		if (!indentStack.length || indentStack[indentStack.length - 1] < indent) indentStack.push(indent);
		items.push({ text, checked: match[2] !== ' ', depth: indentStack.length - 1, line: index + 1 });
	});
	return items;
}
