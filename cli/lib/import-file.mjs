/**
 * Reads a `chronolog import` file (sprint 038-CL): a JSON array of objects, or JSON Lines (one
 * object per line; blank lines and lines starting with `//` are skipped). Each item keeps the line
 * it came from (its position for an array) so output and errors can name it. Pure.
 */

function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** `{ items: [{ line, value }], problems: [{ line, message }] }` */
export function parseImportText(text) {
	const items = [];
	const problems = [];
	const trimmed = text.trim();
	if (trimmed.startsWith('[')) {
		let parsed;
		try {
			parsed = JSON.parse(trimmed);
		} catch (failure) {
			return { items, problems: [{ line: 0, message: `Not valid JSON: ${failure.message}` }] };
		}
		parsed.forEach((value, position) => {
			if (isPlainObject(value)) items.push({ line: position + 1, value });
			else problems.push({ line: position + 1, message: 'item is not a JSON object' });
		});
		return { items, problems };
	}
	text.split(/\r?\n/).forEach((rawLine, position) => {
		const lineText = rawLine.trim();
		if (!lineText || lineText.startsWith('//')) return;
		try {
			const value = JSON.parse(lineText);
			if (isPlainObject(value)) items.push({ line: position + 1, value });
			else problems.push({ line: position + 1, message: 'line is not a JSON object' });
		} catch (failure) {
			problems.push({ line: position + 1, message: `not valid JSON (${failure.message})` });
		}
	});
	return { items, problems };
}

/** Splits `list` into arrays of at most `size`. */
export function chunk(list, size) {
	const chunks = [];
	for (let start = 0; start < list.length; start += size) chunks.push(list.slice(start, start + size));
	return chunks;
}
