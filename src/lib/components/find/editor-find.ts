/**
 * Find in the note editor (sprint 042-CL): a ProseMirror plugin that highlights every match of
 * a query with decorations. Decorations never change the document, so finding does not mark the
 * note edited or start an autosave (TipTap only fires `update` for document changes).
 *
 * The plugin is registered on the live editor when the find bar opens and removed when it closes,
 * so the editor setup (NoteEditor.svelte, owned elsewhere) needs no change.
 */
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/core';
import { findMatchRanges } from '$lib/utils/search-snippet';

export type DocumentMatch = { from: number; to: number };

export type EditorFindState = {
	query: string;
	matches: DocumentMatch[];
	currentIndex: number;
	decorations: DecorationSet;
};

type FindMeta = { query?: string; currentIndex?: number };

export const MATCH_CLASS = 'chronolog-find-match';
export const CURRENT_MATCH_CLASS = 'chronolog-find-current';
/** Stands in for inline atoms (wiki-links, images) so positions stay one-to-one with the text */
const LEAF_PLACEHOLDER = '￼';

export const editorFindKey = new PluginKey<EditorFindState>('chronologFind');

/** Every case-insensitive match of `query` inside the document's text blocks, in document order. */
export function findMatchesInDocument(doc: ProseMirrorNode, query: string): DocumentMatch[] {
	if (!query) return [];
	const matches: DocumentMatch[] = [];
	doc.descendants((node, position) => {
		if (!node.isTextblock) return true;
		const blockText = node.textBetween(0, node.content.size, undefined, LEAF_PLACEHOLDER);
		for (const range of findMatchRanges(blockText, query)) {
			matches.push({ from: position + 1 + range.start, to: position + 1 + range.end });
		}
		return false;
	});
	return matches;
}

function buildState(doc: ProseMirrorNode, query: string, requestedIndex: number): EditorFindState {
	const matches = findMatchesInDocument(doc, query);
	const currentIndex = matches.length === 0 ? -1 : Math.min(Math.max(requestedIndex, 0), matches.length - 1);
	const decorations = DecorationSet.create(
		doc,
		matches.map((match, index) =>
			Decoration.inline(match.from, match.to, {
				class: index === currentIndex ? `${MATCH_CLASS} ${CURRENT_MATCH_CLASS}` : MATCH_CLASS
			})
		)
	);
	return { query, matches, currentIndex, decorations };
}

const EMPTY_STATE: EditorFindState = { query: '', matches: [], currentIndex: -1, decorations: DecorationSet.empty };

export function createEditorFindPlugin(): Plugin<EditorFindState> {
	return new Plugin<EditorFindState>({
		key: editorFindKey,
		state: {
			init: () => EMPTY_STATE,
			apply(transaction: Transaction, previous: EditorFindState, _oldState: EditorState, newState: EditorState) {
				const meta = transaction.getMeta(editorFindKey) as FindMeta | undefined;
				if (!meta && !transaction.docChanged) return previous;
				const query = meta?.query ?? previous.query;
				const currentIndex = meta?.currentIndex ?? previous.currentIndex;
				if (!query) return EMPTY_STATE;
				return buildState(newState.doc, query, currentIndex);
			}
		},
		props: {
			decorations: (state) => editorFindKey.getState(state)?.decorations ?? DecorationSet.empty
		}
	});
}

/** The TipTap editor mounted inside `root` (TipTap stores itself on its element as `.editor`). */
export function findEditorIn(root: ParentNode | null | undefined): Editor | null {
	const element = root?.querySelector('[data-note-editor-content] .tiptap') as (HTMLElement & { editor?: Editor }) | null;
	return element?.editor && !element.editor.isDestroyed ? element.editor : null;
}

export function ensureFindPlugin(editor: Editor): void {
	if (!editorFindKey.getState(editor.state)) editor.registerPlugin(createEditorFindPlugin());
}

export function removeFindPlugin(editor: Editor): void {
	if (!editor.isDestroyed && editorFindKey.getState(editor.state)) editor.unregisterPlugin(editorFindKey);
}

export function getEditorFindState(editor: Editor): EditorFindState {
	return editorFindKey.getState(editor.state) ?? EMPTY_STATE;
}

/** Set the query and/or the current match (meta only: no document change, no autosave). */
export function updateEditorFind(editor: Editor, meta: FindMeta, options: { scroll?: boolean } = {}): EditorFindState {
	ensureFindPlugin(editor);
	editor.view.dispatch(editor.state.tr.setMeta(editorFindKey, meta).setMeta('addToHistory', false));
	if (options.scroll) editor.view.dom.querySelector(`.${CURRENT_MATCH_CLASS}`)?.scrollIntoView?.({ block: 'center' });
	return getEditorFindState(editor);
}
