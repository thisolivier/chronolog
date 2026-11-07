import { Node, mergeAttributes, InputRule, type Range } from '@tiptap/core';
import { type Editor } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Suggestion, type SuggestionOptions } from '@tiptap/suggestion';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { createWikiLinkPickerRenderer } from './wiki-link-picker.svelte.js';
import { isNoteInTrash, subscribeToNoteTitles, wikiLinkDisplayText } from '../note-titles.svelte.js';

/**
 * Result item returned from the note search API endpoint.
 */
export interface WikiLinkSuggestionItem {
	noteId: string;
	title: string;
	firstLine: string;
	secondLine: string;
}

/**
 * Props passed to the suggestion command when a user selects an item.
 */
export interface WikiLinkCommandProps {
	noteId: string;
	label: string;
	headingAnchor?: string;
}

export const WikiLinkPluginKey = new PluginKey('wikiLink');

/** Longest `[[` query the picker follows (059-DR review); longer text is treated as no token */
export const MAX_PICKER_QUERY_LENGTH = 80;

/** Parse the interior text of a `[[...]]` wiki-link (pure; shared with previews and titles). */
import { parseWikiLinkText } from '$lib/utils/wiki-link-text';
export { parseWikiLinkText };

/**
 * Build the `[[...]]` text form of a wiki-link from its components.
 * The label is omitted when it equals the note ID. This is the inverse of
 * `parseWikiLinkText` and is shared by `renderText` and the markdown
 * serializer so saved markdown always round-trips.
 */
export function formatWikiLinkText(
	noteId: string,
	headingAnchor: string | null | undefined,
	label: string | null | undefined
): string {
	let inner = noteId;
	if (headingAnchor) inner += `#${headingAnchor}`;
	if (label && label !== noteId) inner += `|${label}`;
	return `[[${inner}]]`;
}

/**
 * Minimal structural types for the parts of markdown-it the wiki-link parse
 * rule touches. markdown-it is a transitive dependency (via tiptap-markdown),
 * so these local types avoid importing its type package directly.
 */
interface MarkdownItToken {
	content: string;
}

interface MarkdownItInlineState {
	src: string;
	pos: number;
	posMax: number;
	push(type: string, tag: string, nesting: number): MarkdownItToken;
}

type MarkdownItInlineRule = (state: MarkdownItInlineState, silent: boolean) => boolean;

interface MarkdownItLike {
	inline: {
		ruler: {
			before(beforeName: string, ruleName: string, rule: MarkdownItInlineRule): void;
		};
	};
	renderer: {
		rules: Record<string, ((tokens: MarkdownItToken[], index: number) => string) | undefined>;
	};
	utils: {
		escapeHtml(text: string): string;
	};
}

/**
 * The subset of prosemirror-markdown's MarkdownSerializerState the serializer
 * uses (also a transitive dependency, via tiptap-markdown).
 */
interface MarkdownSerializerStateLike {
	write(content: string): void;
}

const WIKI_LINK_TOKEN_TYPE = 'wiki_link';

/** `editor.storage.wikiLink` (besides the tiptap-markdown spec) */
export interface WikiLinkStorage {
	getCurrentNoteId: () => string | null;
	/**
	 * Start of a `[[` token whose picker was dismissed (Escape, outside press, blur; 059-DR): the
	 * suggestion stays closed while typing on in it. Cleared once that `[[` is gone.
	 */
	dismissedFrom: number | null;
}

/**
 * markdown-it inline rule: recognises `[[...]]` and emits a `wiki_link` token.
 * The interior may not contain brackets or newlines. Runs before the built-in
 * `link` rule so the opening bracket is never consumed as a regular link.
 */
const wikiLinkInlineRule: MarkdownItInlineRule = (state, silent) => {
	const start = state.pos;
	if (state.src.charCodeAt(start) !== 0x5b /* [ */) return false;
	if (state.src.charCodeAt(start + 1) !== 0x5b /* [ */) return false;

	const closeIndex = state.src.indexOf(']]', start + 2);
	if (closeIndex === -1 || closeIndex + 2 > state.posMax) return false;

	const interior = state.src.slice(start + 2, closeIndex);
	if (!interior || /[[\]\n]/.test(interior)) return false;

	if (!silent) {
		const token = state.push(WIKI_LINK_TOKEN_TYPE, 'span', 0);
		token.content = interior;
	}

	state.pos = closeIndex + 2;
	return true;
};

/**
 * Register the wiki-link rule and renderer on a markdown-it instance.
 * tiptap-markdown calls `parse.setup` on every parse, so this is idempotent.
 */
function registerWikiLinkMarkdownRule(markdownit: MarkdownItLike): void {
	if (markdownit.renderer.rules[WIKI_LINK_TOKEN_TYPE]) return;

	markdownit.inline.ruler.before('link', WIKI_LINK_TOKEN_TYPE, wikiLinkInlineRule);

	// Render to the same HTML shape that `parseHTML` / `renderHTML` use so the
	// generated DOM is picked up as a wikiLink node by TipTap.
	markdownit.renderer.rules[WIKI_LINK_TOKEN_TYPE] = (tokens, index) => {
		const { noteId, headingAnchor, label } = parseWikiLinkText(tokens[index].content);
		const escape = markdownit.utils.escapeHtml;

		let attributes = ` data-note-id="${escape(noteId)}" data-label="${escape(label)}"`;
		if (headingAnchor) {
			attributes += ` data-heading-anchor="${escape(headingAnchor)}"`;
		}

		return `<span data-wiki-link=""${attributes}>${escape(label)}</span>`;
	};
}

/**
 * WikiLink is an inline TipTap Node extension that renders `[[note-links]]`
 * in the editor. It supports the full wiki-link syntax:
 *
 * - `[[NOTE_ID]]` -- plain link
 * - `[[NOTE_ID|label]]` -- link with display text
 * - `[[NOTE_ID#heading]]` -- link to heading
 * - `[[NOTE_ID#heading|label]]` -- heading link with display text
 *
 * It integrates TipTap's Suggestion utility (triggered by `[[`) to provide
 * autocomplete when typing wiki-links.
 *
 * It also contributes a tiptap-markdown spec (via `addStorage().markdown`) so
 * `getMarkdown()` serialises the node as `[[...]]` text and markdown
 * containing `[[...]]` parses back into wikiLink nodes.
 */
export const WikiLink = Node.create<{
	suggestion: Partial<SuggestionOptions<WikiLinkSuggestionItem, WikiLinkCommandProps>>;
	HTMLAttributes: Record<string, string>;
}>({
	name: 'wikiLink',

	group: 'inline',

	inline: true,

	atom: true,

	selectable: true,

	addOptions() {
		return {
			HTMLAttributes: {},
			suggestion: {
				char: '[[',
				allowSpaces: true,
				pluginKey: WikiLinkPluginKey,

				// The picker queries for itself (debounced, stale replies ignored; 059-DR), so the
				// plugin's own awaited items stay empty and can never overwrite newer results
				items: () => [],

				// A `[[` never closed and followed by a sentence is not a link query (the endpoint refuses
				// over 200 characters): no picker past 80 characters
				shouldShow: ({ query }: { query: string }) => query.length <= MAX_PICKER_QUERY_LENGTH && !query.includes('\n'),

				// A dismissed token stays closed until its `[[` is removed (see dismissedFrom)
				allow: ({ editor, range }: { editor: Editor; range: Range }) =>
					(editor.storage as unknown as Record<string, WikiLinkStorage | undefined>).wikiLink?.dismissedFrom !== range.from,

				command: ({
					editor,
					range,
					props: commandProps,
				}: {
					editor: Editor;
					range: Range;
					props: WikiLinkCommandProps;
				}) => {
					// Replace the typed `[[query` range with a wikiLink node
					// and then insert a closing space so the cursor moves past
					// the node.
					editor
						.chain()
						.focus()
						.insertContentAt(range, [
							{
								type: 'wikiLink',
								attrs: {
									noteId: commandProps.noteId,
									label: commandProps.label,
									headingAnchor: commandProps.headingAnchor ?? null,
								},
							},
							{ type: 'text', text: ' ' },
						])
						.run();
				},

				render: createWikiLinkPickerRenderer(WikiLinkPluginKey),
			},
		};
	},

	addStorage(): WikiLinkStorage & Record<string, unknown> {
		return {
			// NoteEditor replaces this so `[[` suggestions exclude the note being edited
			getCurrentNoteId: () => null,
			dismissedFrom: null,
			// tiptap-markdown node spec: see MarkdownNodeSpec in tiptap-markdown.
			markdown: {
				serialize(state: MarkdownSerializerStateLike, node: ProseMirrorNode) {
					// `state.write` emits raw text without markdown escaping, so note
					// IDs such as `INTL.20261103.002` are preserved verbatim.
					state.write(
						formatWikiLinkText(
							node.attrs.noteId as string,
							node.attrs.headingAnchor as string | null,
							node.attrs.label as string | null
						)
					);
				},
				parse: {
					setup(markdownit: MarkdownItLike) {
						registerWikiLinkMarkdownRule(markdownit);
					},
				},
			},
		};
	},

	addAttributes() {
		return {
			noteId: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute('data-note-id'),
				renderHTML: (attributes: Record<string, string>) => ({
					'data-note-id': attributes.noteId,
				}),
			},
			label: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute('data-label'),
				renderHTML: (attributes: Record<string, string>) => ({
					'data-label': attributes.label,
				}),
			},
			headingAnchor: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute('data-heading-anchor'),
				renderHTML: (attributes: Record<string, string | null>) => {
					if (!attributes.headingAnchor) return {};
					return { 'data-heading-anchor': attributes.headingAnchor };
				},
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: 'span[data-wiki-link]',
			},
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		const label = (node.attrs.label as string) || (node.attrs.noteId as string) || '';

		return [
			'span',
			mergeAttributes(
				{ 'data-wiki-link': '' },
				this.options.HTMLAttributes,
				HTMLAttributes,
				{ class: 'wiki-link' }
			),
			label,
		];
	},

	addNodeView() {
		// Shows the linked note's title (from the shared title cache), with the ID as a
		// tooltip. The document keeps only the ID, so markdown stays `[[id]]`.
		return ({ node }) => {
			const element = document.createElement('span');
			element.className = 'wiki-link';
			element.setAttribute('data-wiki-link', '');
			element.contentEditable = 'false';
			let currentNode: ProseMirrorNode = node;

			const render = () => {
				const noteId = currentNode.attrs.noteId as string;
				const label = currentNode.attrs.label as string | null;
				const headingAnchor = currentNode.attrs.headingAnchor as string | null;
				element.setAttribute('data-note-id', noteId ?? '');
				if (label) element.setAttribute('data-label', label);
				if (headingAnchor) element.setAttribute('data-heading-anchor', headingAnchor);
				else element.removeAttribute('data-heading-anchor');
				const text = wikiLinkDisplayText(noteId, label) + (headingAnchor ? ` › ${headingAnchor}` : '');
				if (element.textContent !== text) element.textContent = text;
				const target = headingAnchor ? `${noteId}#${headingAnchor}` : noteId;
				// A link to a note in the trash is muted; clicking it offers a restore (sprint 037-CL)
				const trashed = Boolean(noteId) && isNoteInTrash(noteId);
				element.classList.toggle('wiki-link-deleted', trashed);
				if (trashed) element.setAttribute('data-deleted', '');
				else element.removeAttribute('data-deleted');
				element.title = trashed ? `${target} (deleted: click to restore)` : target;
			};

			render();
			const unsubscribe = subscribeToNoteTitles(render);

			return {
				dom: element,
				update(updatedNode) {
					if (updatedNode.type !== currentNode.type) return false;
					currentNode = updatedNode;
					render();
					return true;
				},
				ignoreMutation: () => true,
				destroy: unsubscribe,
			};
		};
	},

	renderText({ node }) {
		return formatWikiLinkText(
			node.attrs.noteId as string,
			node.attrs.headingAnchor as string | null,
			node.attrs.label as string | null
		);
	},

	addInputRules() {
		return [
			new InputRule({
				// Match `[[...]]` when typed. The regex captures the interior.
				find: /\[\[([^\]]+)\]\]$/,
				handler: ({ state, range, match }) => {
					const fullMatch = match[1];
					if (!fullMatch) return;

					const { noteId, headingAnchor, label } = parseWikiLinkText(fullMatch);

					const nodeType = state.schema.nodes.wikiLink;
					if (!nodeType) return;

					const wikiLinkNode = nodeType.create({
						noteId,
						headingAnchor: headingAnchor ?? null,
						label,
					});

					const transaction = state.tr.replaceWith(range.from, range.to, wikiLinkNode);
					state.apply(transaction);
				},
			}),
		];
	},

	onTransaction({ transaction }) {
		// Forget a dismissed token once its `[[` has gone (deleted, or replaced by a link)
		const storage = this.storage as unknown as WikiLinkStorage;
		if (storage.dismissedFrom === null || !transaction.docChanged) return;
		const mapped = transaction.mapping.mapResult(storage.dismissedFrom);
		const doc = transaction.doc;
		const stillThere =
			!mapped.deleted && mapped.pos + 2 <= doc.content.size && doc.textBetween(mapped.pos, mapped.pos + 2) === '[[';
		storage.dismissedFrom = stillThere ? mapped.pos : null;
	},

	addProseMirrorPlugins() {
		return [
			Suggestion({
				editor: this.editor,
				...this.options.suggestion,
			}),
		];
	},
});
