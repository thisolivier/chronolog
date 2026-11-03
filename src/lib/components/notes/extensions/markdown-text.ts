import { Node } from '@tiptap/core';

/**
 * Plain-text node with a markdown serializer that keeps text readable.
 *
 * tiptap-markdown's default text serializer HTML-escapes every `<` and `>`, so a note
 * containing `L1 -> on-call` was saved (and shown in raw mode and the Markdown export)
 * as `L1 -&gt; on-call`. Markdown only needs `<` escaped where it could open an HTML tag,
 * comment or autolink (it is parsed with `html: true`); `>` and `&` are left alone.
 * Markdown-level escaping (`*`, `_`, leading `#` / `>` ...) still comes from `state.text`.
 *
 * Replaces StarterKit's `text` node (`StarterKit.configure({ text: false })`).
 */

interface MarkdownTextSerializerState {
	text(text: string, escape?: boolean): void;
}

/** Escape `<` only when the next character could start a tag, comment or autolink. */
export function escapeTagOpeners(text: string): string {
	return text.replace(/<(?=[A-Za-z/!?])/g, '&lt;');
}

export const MarkdownText = Node.create({
	name: 'text',
	group: 'inline',

	addStorage() {
		return {
			markdown: {
				serialize(state: MarkdownTextSerializerState, node: { text?: string }) {
					state.text(escapeTagOpeners(node.text ?? ''));
				},
				parse: {
					// handled by markdown-it
				}
			}
		};
	}
});
