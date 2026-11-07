/**
 * The editor's `[[` suggestion popup (059-DR, SR-04..SR-07), replacing the vanilla-DOM
 * SuggestionDropdown. TipTap's suggestion plugin reports the active `[[query` token; this renderer
 * hands each query to the shared `createLinkPickerSearch` (debounced, stale replies ignored) and
 * mounts the shared `LinkPicker` list in a `position: fixed` layer on <body>, placed by
 * `placeLinkPicker` against the visual viewport (above a phone's keyboard).
 *
 * Focus never leaves the editor: arrows move the active row, Enter / click / tap inserts through
 * the plugin's command (one transaction, so one undo). Escape, a press outside the editor and the
 * list, or the editor losing focus close the popup for good: the token's position is recorded as
 * dismissed (`WikiLinkStorage.dismissedFrom`, honoured by the suggestion's `allow`), so typing
 * on in that token does not bring it back, and the popup is unmounted rather than hidden.
 */
import { mount, tick, unmount } from 'svelte';
import type { Editor } from '@tiptap/core';
import { exitSuggestion, type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';
import type { PluginKey } from '@tiptap/pm/state';
import LinkPicker from '$lib/components/search/LinkPicker.svelte';
import { createLinkPickerSearch, type LinkPickerSearch } from '$lib/components/search/link-picker-search.svelte';
import { placeLinkPicker } from '$lib/components/search/link-picker-placement';
import type { LinkPickerItem } from '$lib/components/search/link-targets';

export type WikiLinkPickerCommand = { noteId: string; label: string };

type PickerStorage = { getCurrentNoteId: () => string | null; dismissedFrom: number | null };

const PHONE_QUERY = '(max-width: 767px)';
let pickerCount = 0;

function storageOf(editor: Editor): PickerStorage | undefined {
	return (editor.storage as unknown as Record<string, PickerStorage | undefined>).wikiLink;
}

/** The suggestion `render` option: one popup per `[[` token */
export function createWikiLinkPickerRenderer(pluginKey: PluginKey) {
	return () => {
		let editor: Editor | null = null;
		let latest: SuggestionProps<unknown, WikiLinkPickerCommand> | null = null;
		let search: LinkPickerSearch | null = null;
		let layer: HTMLDivElement | null = null;
		let instance: ReturnType<typeof mount> | null = null;
		let cleanups: Array<() => void> = [];
		/** Enter pressed while the current query was still loading: insert from ITS reply */
		let enterPending = false;
		const idPrefix = `link-picker-${++pickerCount}`;
		const view = $state({
			items: [] as LinkPickerItem[],
			status: 'loading' as 'loading' | 'ready' | 'error',
			activeIndex: 0,
			variant: 'desktop' as 'desktop' | 'phone',
			maxHeight: undefined as number | undefined
		});

		function choose(index: number) {
			const item = view.items[index];
			if (!item || !latest) return;
			// No explicit label: the chip shows the note's live title, the markdown stays [[ID]]
			latest.command({ noteId: item.noteId, label: item.noteId });
		}

		function syncFromSearch() {
			if (!search) return;
			const itemsChanged = view.items !== search.items;
			view.items = search.items;
			view.status = search.status;
			if (itemsChanged) view.activeIndex = 0;
			if (enterPending && search.status !== 'loading') {
				enterPending = false;
				// The rows shown before were for an older query: only the current reply may be inserted
				if (search.status === 'ready' && view.items[view.activeIndex]) {
					choose(view.activeIndex);
					return;
				}
			}
			void tick().then(position);
		}

		function position() {
			if (!layer || !latest?.clientRect) return;
			const anchor = latest.clientRect();
			if (!anchor) return;
			const visual = window.visualViewport;
			const viewport = visual
				? { top: visual.offsetTop, left: visual.offsetLeft, width: visual.width, height: visual.height }
				: { top: 0, left: 0, width: document.documentElement.clientWidth, height: window.innerHeight };
			const panel = layer.firstElementChild as HTMLElement | null;
			const list = panel?.querySelector<HTMLElement>('[role="listbox"]');
			const contentHeight = panel && list ? panel.offsetHeight - list.clientHeight + list.scrollHeight : 0;
			const placement = placeLinkPicker({ anchor, viewport, contentHeight, isPhone: view.variant === 'phone' });
			layer.style.top = `${placement.top}px`;
			layer.style.left = `${placement.left}px`;
			layer.style.width = `${placement.width}px`;
			view.maxHeight = placement.maxHeight;
			layer.dataset.side = placement.side;
		}

		/** Close for good: remember the token as dismissed and end the plugin's suggestion */
		function dismiss() {
			if (!editor || !latest) return;
			const storage = storageOf(editor);
			if (storage) storage.dismissedFrom = latest.range.from;
			exitSuggestion(editor.view, pluginKey);
		}

		function listen<K extends keyof WindowEventMap>(target: EventTarget, type: K | string, handler: EventListener, options?: AddEventListenerOptions) {
			target.addEventListener(type, handler, options);
			cleanups.push(() => target.removeEventListener(type, handler, options));
		}

		function destroy() {
			enterPending = false;
			search?.dispose();
			search = null;
			for (const cleanup of cleanups) cleanup();
			cleanups = [];
			if (instance) void unmount(instance);
			instance = null;
			layer?.remove();
			layer = null;
			editor = null;
			latest = null;
		}

		return {
			onStart(props: SuggestionProps<unknown, WikiLinkPickerCommand>) {
				destroy();
				editor = props.editor;
				latest = props;
				view.variant = window.matchMedia(PHONE_QUERY).matches ? 'phone' : 'desktop';
				search = createLinkPickerSearch({ onChange: syncFromSearch });

				layer = document.createElement('div');
				layer.className = 'fixed z-50';
				layer.dataset.linkPickerLayer = '';
				document.body.appendChild(layer);
				instance = mount(LinkPicker, {
					target: layer,
					props: {
						get items() {
							return view.items;
						},
						get status() {
							return view.status;
						},
						get activeIndex() {
							return view.activeIndex;
						},
						get variant() {
							return view.variant;
						},
						get maxHeight() {
							return view.maxHeight;
						},
						idPrefix,
						onChoose: choose,
						onActivate: (index: number) => (view.activeIndex = index)
					}
				});

				const reposition = () => position();
				if (window.visualViewport) {
					listen(window.visualViewport, 'resize', reposition);
					listen(window.visualViewport, 'scroll', reposition);
				}
				listen(window, 'resize', reposition);
				listen(document, 'scroll', reposition, { capture: true, passive: true });
				// A press outside the editor and the list closes it (inside the editor, moving the caret
				// out of the token closes it through the plugin)
				listen(document, 'pointerdown', ((event: PointerEvent) => {
					const target = event.target as Node | null;
					if (!target || layer?.contains(target) || editor?.view.dom.contains(target)) return;
					dismiss();
				}) as EventListener, { capture: true });
				const onBlur = ({ event }: { event: FocusEvent }) => {
					const next = event.relatedTarget as Node | null;
					if (next && layer?.contains(next)) return;
					dismiss();
				};
				editor.on('blur', onBlur);
				const ownEditor = editor;
				cleanups.push(() => ownEditor.off('blur', onBlur));

				search.setQuery(props.query ?? '', { exclude: storageOf(editor)?.getCurrentNoteId() ?? null });
				void tick().then(position);
			},

			onUpdate(props: SuggestionProps<unknown, WikiLinkPickerCommand>) {
				latest = props;
				// Typing on after Enter means the earlier Enter no longer applies
				if (props.query !== search?.query) enterPending = false;
				search?.setQuery(props.query ?? '');
				position();
			},

			onKeyDown({ event }: SuggestionKeyDownProps): boolean {
				if (!search) return false;
				if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
					if (view.items.length === 0) return true;
					const step = event.key === 'ArrowDown' ? 1 : -1;
					view.activeIndex = Math.min(Math.max(view.activeIndex + step, 0), view.items.length - 1);
					return true;
				}
				if (event.key === 'Enter') {
					// Rows still on screen during a load belong to the previous query (review fix, 059-DR)
					if (search.status === 'loading') {
						enterPending = true;
						return true;
					}
					if (!view.items[view.activeIndex]) return false;
					choose(view.activeIndex);
					return true;
				}
				if (event.key === 'Escape') {
					// The plugin then ends the suggestion (onExit); the typed text stays
					if (editor && latest) {
						const storage = storageOf(editor);
						if (storage) storage.dismissedFrom = latest.range.from;
					}
					return false;
				}
				return false;
			},

			onExit() {
				destroy();
			}
		};
	};
}
