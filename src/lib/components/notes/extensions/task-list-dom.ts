/**
 * Parse-time fix-up for task lists (sprint 040-CL). markdown-it puts `- a` and `- [ ] b` in one
 * list when they share a marker; markdown-it-task-lists then marks the whole list as a task list
 * though only some items are tasks, and TipTap cannot place the plain items in it. Each such list
 * is split into runs: task items stay a task list, the others become a plain bullet list.
 */

const TASK_LIST_SELECTOR = 'ul.contains-task-list, ul[data-type="taskList"]';

function isTaskListItem(item: Element): boolean {
	return item.classList.contains('task-list-item') || item.getAttribute('data-type') === 'taskItem';
}

/** Split every mixed task list under `root` into consecutive task and bullet lists. */
export function splitMixedTaskLists(root: ParentNode): void {
	// deepest first, so a nested mixed list is fixed before its parent is cloned around
	const lists = Array.from(root.querySelectorAll(TASK_LIST_SELECTOR)).reverse();
	for (const list of lists) {
		const items = Array.from(list.children).filter((child) => child.tagName === 'LI');
		if (items.every(isTaskListItem)) continue;

		const runs: { isTask: boolean; items: Element[] }[] = [];
		for (const item of items) {
			const isTask = isTaskListItem(item);
			const lastRun = runs[runs.length - 1];
			if (lastRun && lastRun.isTask === isTask) lastRun.items.push(item);
			else runs.push({ isTask, items: [item] });
		}

		const ownerDocument = list.ownerDocument;
		for (const run of runs) {
			const replacement = ownerDocument.createElement('ul');
			if (run.isTask) {
				replacement.className = 'contains-task-list';
				replacement.setAttribute('data-type', 'taskList');
			}
			run.items.forEach((item) => replacement.appendChild(item));
			list.parentNode?.insertBefore(replacement, list);
		}
		list.remove();
	}
}
