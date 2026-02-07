import { Node, mergeAttributes, type Range } from '@tiptap/core';
import { type Editor } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Suggestion, type SuggestionOptions } from '@tiptap/suggestion';
import { SuggestionDropdown } from './SuggestionDropdown.js';

/**
 * Result item returned from the note search API endpoint.
 */
export interface WikiLinkSuggestionItem {
	noteId: string;
	title: string;
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

/**
 * Parse the interior text of a `[[...]]` wiki-link into its components.
 *
 * Supported forms:
 *   NOTE_ID
 *   NOTE_ID|label
 *   NOTE_ID#heading
 *   NOTE_ID#heading|label
 */
export function parseWikiLinkText(raw: string): {
	noteId: string;
	headingAnchor?: string;
	label: string;
} {
	let noteId = raw;
	let headingAnchor: string | undefined;
	let label: string | undefined;

	// Extract label after the pipe
	const pipeIndex = noteId.indexOf('|');
	if (pipeIndex !== -1) {
		label = noteId.slice(pipeIndex + 1);
		noteId = noteId.slice(0, pipeIndex);
	}

	// Extract heading anchor after the hash
	const hashIndex = noteId.indexOf('#');
	if (hashIndex !== -1) {
		headingAnchor = noteId.slice(hashIndex + 1);
		noteId = noteId.slice(0, hashIndex);
	}

	return {
		noteId,
		headingAnchor: headingAnchor || undefined,
		label: label || noteId,
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

				items: async ({ query }: { query: string }) => {
					if (!query || query.length < 1) {
						return [];
					}

					try {
						const response = await fetch(
							`/api/notes/search?q=${encodeURIComponent(query)}`
						);
						if (!response.ok) return [];
						const data = await response.json();
						// Map API shape { id, title } to WikiLinkSuggestionItem { noteId, title }
						return (data.notes ?? []).map((note: { id: string; title: string | null }) => ({
							noteId: note.id,
							title: note.title ?? note.id,
						}));
					} catch {
						return [];
					}
				},

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

				render: () => {
					let dropdown: SuggestionDropdown | null = null;

					return {
						onStart(props) {
							dropdown = new SuggestionDropdown({
								items: props.items,
								command: (item: WikiLinkSuggestionItem) => {
									props.command({
										noteId: item.noteId,
										label: item.title || item.noteId,
									});
								},
								clientRect: props.clientRect ?? null,
							});
						},

						onUpdate(props) {
							dropdown?.update({
								items: props.items,
								command: (item: WikiLinkSuggestionItem) => {
									props.command({
										noteId: item.noteId,
										label: item.title || item.noteId,
									});
								},
								clientRect: props.clientRect ?? null,
							});
						},

						onKeyDown(props) {
							if (!dropdown) return false;
							return dropdown.onKeyDown(props.event);
						},

						onExit() {
							dropdown?.destroy();
							dropdown = null;
						},
					};
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

	renderText({ node }) {
		const noteId = node.attrs.noteId as string;
		const headingAnchor = node.attrs.headingAnchor as string | null;
		const label = node.attrs.label as string | null;

		let inner = noteId;
		if (headingAnchor) inner += `#${headingAnchor}`;
		if (label && label !== noteId) inner += `|${label}`;

		return `[[${inner}]]`;
	},

	addInputRules() {
		return [
			{
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
			},
		];
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
