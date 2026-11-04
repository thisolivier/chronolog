import { Extension, InputRule } from '@tiptap/core';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection, type Transaction } from '@tiptap/pm/state';
import { canJoin } from '@tiptap/pm/transform';
import { splitMixedTaskLists } from './task-list-dom';

/**
 * Checkbox task lists (sprint 040-CL): `- [ ] open` / `- [x] done`, nestable.
 *
 * The official TipTap TaskList / TaskItem nodes, with three Chronolog changes:
 * - task lists serialise tight (one line per item, as typed) and switch their marker to `*` next
 *   to a bullet list, so the two never merge into one list when the markdown is read back;
 * - typing `[ ] `, `[] ` or `[x] ` at the start of a bullet or numbered list item turns that item
 *   into a task item (the stock rule would nest a new task list inside it);
 * - mixed markdown lists (`- a` then `- [ ] b` in one list, as a person or the CLI may write them)
 *   are split into a bullet list and a task list when parsed.
 * tiptap-markdown's own task-list spec (markdown-it-task-lists) still does the parsing.
 */

/** Same pattern as the stock TaskItem input rule: `[ ]`, `[]`, `[x]` then a space. */
const TASK_MARKER_INPUT = /^\s*(\[([( |x])?\])\s$/;

interface ListSerializerState {
	renderList(node: ProseMirrorNode, delimiter: string, firstDelimiter: (index: number) => string): void;
}

/** The marker for a task list: `*` beside a bullet list (which uses `-`), else `-`. */
export function taskListMarker(parent: ProseMirrorNode | null | undefined, index: number): '-' | '*' {
	if (!parent) return '-';
	const isBulletList = (position: number) =>
		position >= 0 && position < parent.childCount && parent.child(position).type.name === 'bulletList';
	return isBulletList(index - 1) || isBulletList(index + 1) ? '*' : '-';
}

export const ChronologTaskList = TaskList.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			// Read by prosemirror-markdown's renderList: one line per item, no blank lines between
			tight: { default: true, rendered: false, parseHTML: () => true }
		};
	},

	addStorage() {
		return {
			...this.parent?.(),
			markdown: {
				serialize(state: ListSerializerState, node: ProseMirrorNode, parent: ProseMirrorNode, index: number) {
					const marker = taskListMarker(parent, index);
					state.renderList(node, '  ', () => `${marker} `);
				}
			}
		};
	}
});

/**
 * Turn the list item holding `$from` (a bullet or numbered list item, caret in its first paragraph)
 * into a task item: the list is split around it, and the new task list joins a task list beside it.
 */
function convertListItemToTaskItem(
	transaction: Transaction,
	paragraphPosition: number,
	checked: boolean
): boolean {
	const schema = transaction.doc.type.schema;
	const $paragraph = transaction.doc.resolve(paragraphPosition);
	const itemDepth = $paragraph.depth - 1;
	if (itemDepth < 1) return false;
	const listItem = $paragraph.node(itemDepth);
	const list = $paragraph.node(itemDepth - 1);
	if (listItem.type.name !== 'listItem' || $paragraph.index(itemDepth) !== 0) return false;
	if (list.type.name !== 'bulletList' && list.type.name !== 'orderedList') return false;

	const itemIndex = $paragraph.index(itemDepth - 1);
	const itemsBefore: ProseMirrorNode[] = [];
	const itemsAfter: ProseMirrorNode[] = [];
	list.forEach((child, _offset, index) => {
		if (index < itemIndex) itemsBefore.push(child);
		if (index > itemIndex) itemsAfter.push(child);
	});

	const taskList = schema.nodes.taskList.create(null, schema.nodes.taskItem.create({ checked }, listItem.content));
	const listBefore = itemsBefore.length ? list.type.create(list.attrs, itemsBefore) : null;
	const listAfter = itemsAfter.length ? list.type.create(list.attrs, itemsAfter) : null;
	const pieces = [listBefore, taskList, listAfter].filter((piece): piece is ProseMirrorNode => piece !== null);

	const listStart = $paragraph.before(itemDepth - 1);
	transaction.replaceWith(listStart, listStart + list.nodeSize, pieces);

	const taskListStart = listStart + (listBefore?.nodeSize ?? 0);
	// caret: inside taskList > taskItem > paragraph
	let caretPosition = taskListStart + 3;
	const taskListEnd = taskListStart + taskList.nodeSize;
	const joinsForward = !listAfter && canJoin(transaction.doc, taskListEnd) && transaction.doc.resolve(taskListEnd).nodeAfter?.type.name === 'taskList';
	if (joinsForward) transaction.join(taskListEnd);
	const joinsBackward = !listBefore && canJoin(transaction.doc, taskListStart) && transaction.doc.resolve(taskListStart).nodeBefore?.type.name === 'taskList';
	if (joinsBackward) {
		// the closing token of the previous list and the opening one of ours are gone
		transaction.join(taskListStart);
		caretPosition = taskListStart + 1;
	}
	transaction.setSelection(TextSelection.create(transaction.doc, caretPosition));
	return true;
}

export const ChronologTaskItem = TaskItem.extend({
	addInputRules() {
		const listItemRule = new InputRule({
			find: TASK_MARKER_INPUT,
			handler: ({ state, range, match }) => {
				const $from = state.doc.resolve(range.from);
				if ($from.parent.type.name !== 'paragraph' || $from.depth < 2) return null;
				if ($from.node($from.depth - 1).type.name !== 'listItem') return null;
				const transaction = state.tr;
				transaction.delete(range.from, range.to);
				convertListItemToTaskItem(transaction, range.from, match[match.length - 1] === 'x');
				return undefined;
			}
		});
		// Anywhere else the stock rule applies: a new task list
		return [listItemRule, ...(this.parent?.() ?? [])];
	},

	addProseMirrorPlugins() {
		return [
			...(this.parent?.() ?? []),
			// The stock checkbox handler runs `focus()` and then sets `checked` in one chain. In an
			// unfocused editor Safari focuses the DOM synchronously inside that chain, TipTap dispatches
			// its focus transaction there, the chain's own transaction no longer matches the state
			// ("Applying a mismatched transaction") and the tick is lost. Focusing the editor on
			// mousedown, before the change event, makes that `focus()` a no-op. A native capture
			// listener: ProseMirror does not pass this mousedown to plugin handlers.
			new Plugin({
				key: new PluginKey('taskCheckboxFocus'),
				view: (view) => {
					const focusBeforeCheckboxChange = (event: MouseEvent) => {
						const target = event.target as HTMLElement | null;
						if (view.editable && !view.hasFocus() && target?.matches('li > label > input[type="checkbox"]')) {
							view.focus();
						}
					};
					view.dom.addEventListener('mousedown', focusBeforeCheckboxChange, true);
					return { destroy: () => view.dom.removeEventListener('mousedown', focusBeforeCheckboxChange, true) };
				}
			})
		];
	}
}).configure({ nested: true });

/** Splits mixed bullet/task lists while markdown is parsed (see `task-list-dom.ts`). */
export const TaskListMarkdownNormaliser = Extension.create({
	name: 'taskListMarkdownNormaliser',
	addStorage() {
		return {
			markdown: {
				parse: {
					updateDOM(element: HTMLElement) {
						splitMixedTaskLists(element);
					}
				}
			}
		};
	}
});

/** Everything the editor registers for task lists. */
export const TaskListExtensions = [ChronologTaskList, ChronologTaskItem, TaskListMarkdownNormaliser];
