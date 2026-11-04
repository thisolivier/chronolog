<!--
	Find in page (sprint 042-CL). Mounted as the first child of a panel (the note editor or the
	timesheet); Cmd+F / Ctrl+F opens it only while focus (or the last click) is inside that panel,
	so the browser's own find still works everywhere else. `editor` mode highlights with
	ProseMirror decorations (the note is not changed); `dom` mode paints CSS highlights.
-->
<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import type { Editor } from '@tiptap/core';
	import { isFindShortcut, OPEN_FIND_EVENT } from './shortcuts';
	import { clearPaintedRanges, findRangesIn, installFindStyles, paintRanges } from './dom-find';
	import { findEditorIn, getEditorFindState, removeFindPlugin, updateEditorFind } from './editor-find';

	let { mode }: { mode: 'editor' | 'dom' } = $props();

	let anchor: HTMLElement | undefined = $state();
	let input: HTMLInputElement | undefined = $state();
	let isOpen = $state(false);
	let query = $state('');
	let matchCount = $state(0);
	let currentIndex = $state(-1);
	let lastPointerInsidePanel = false;
	let registeredEditor: Editor | null = null;
	let domRanges: Range[] = [];
	let watcher: { stop: () => void } | null = null;

	const panelRoot = () => anchor?.parentElement ?? null;

	function runSearch(options: { scroll: boolean }) {
		const root = panelRoot();
		if (!root) return;
		if (mode === 'editor') {
			const editor = findEditorIn(root);
			if (registeredEditor && registeredEditor !== editor) removeFindPlugin(registeredEditor);
			registeredEditor = editor;
			if (!editor) {
				matchCount = 0;
				currentIndex = -1;
				return;
			}
			const state = updateEditorFind(editor, { query, currentIndex: Math.max(currentIndex, 0) }, options);
			matchCount = state.matches.length;
			currentIndex = state.currentIndex;
		} else {
			domRanges = findRangesIn(root, query);
			matchCount = domRanges.length;
			currentIndex = matchCount === 0 ? -1 : Math.min(Math.max(currentIndex, 0), matchCount - 1);
			paintRanges(domRanges, currentIndex, options);
		}
	}

	/** Keep the matches current while the bar is open: the page changes under it */
	function startWatching(): { stop: () => void } {
		if (mode === 'editor') {
			const interval = setInterval(() => {
				const editor = findEditorIn(panelRoot());
				if (editor !== registeredEditor) return runSearch({ scroll: false });
				if (!editor) return;
				const state = getEditorFindState(editor);
				matchCount = state.matches.length;
				currentIndex = state.currentIndex;
			}, 400);
			return { stop: () => clearInterval(interval) };
		}
		let pending: ReturnType<typeof setTimeout> | undefined;
		const observer = new MutationObserver((records) => {
			if (records.every((record) => anchor?.contains(record.target))) return;
			clearTimeout(pending);
			pending = setTimeout(() => runSearch({ scroll: false }), 150);
		});
		const root = panelRoot();
		if (root) observer.observe(root, { subtree: true, childList: true, characterData: true });
		return { stop: () => (clearTimeout(pending), observer.disconnect()) };
	}

	async function open() {
		installFindStyles();
		if (!isOpen) {
			isOpen = true;
			watcher = startWatching();
		}
		await tick();
		input?.focus();
		input?.select();
		if (query) runSearch({ scroll: true });
	}

	function close({ restoreFocus = true } = {}) {
		if (!isOpen) return;
		isOpen = false;
		watcher?.stop();
		watcher = null;
		if (registeredEditor && !registeredEditor.isDestroyed) {
			const current = getEditorFindState(registeredEditor).matches[currentIndex];
			removeFindPlugin(registeredEditor);
			// Leave the caret on the match, like the browser's find (a selection, not an edit)
			if (restoreFocus && current) registeredEditor.chain().setTextSelection(current).focus().run();
			else if (restoreFocus) registeredEditor.commands.focus();
		}
		registeredEditor = null;
		clearPaintedRanges();
		domRanges = [];
		matchCount = 0;
		currentIndex = -1;
	}

	function move(step: number) {
		if (matchCount === 0) return;
		currentIndex = (currentIndex + step + matchCount) % matchCount;
		if (mode === 'editor' && registeredEditor) {
			updateEditorFind(registeredEditor, { currentIndex }, { scroll: true });
		} else {
			paintRanges(domRanges, currentIndex, { scroll: true });
		}
	}

	function handleInput() {
		currentIndex = 0;
		runSearch({ scroll: true });
	}

	function handleInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			move(event.shiftKey ? -1 : 1);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			close();
		}
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (!isFindShortcut(event)) return;
		const root = panelRoot();
		if (!root) return;
		const active = document.activeElement;
		const focusIsInside = active && active !== document.body ? root.contains(active) : lastPointerInsidePanel;
		if (!focusIsInside) return;
		if (mode === 'editor' && !findEditorIn(root)) return;
		event.preventDefault();
		void open();
	}

	/** The phone title bar's Find button (no keyboard shortcut on a phone) */
	function handleOpenFindRequest() {
		const root = panelRoot();
		if (!root?.isConnected) return;
		if (mode === 'editor' && !findEditorIn(root)) return;
		void open();
	}

	$effect(() => {
		window.addEventListener(OPEN_FIND_EVENT, handleOpenFindRequest);
		return () => window.removeEventListener(OPEN_FIND_EVENT, handleOpenFindRequest);
	});

	function handleWindowPointerdown(event: PointerEvent) {
		lastPointerInsidePanel = !!panelRoot()?.contains(event.target as Node);
	}

	onDestroy(() => close({ restoreFocus: false }));

	const countLabel = $derived(matchCount > 0 ? `${currentIndex + 1} of ${matchCount}` : query ? 'No matches' : '');
</script>

<svelte:window onkeydowncapture={handleWindowKeydown} onpointerdowncapture={handleWindowPointerdown} />

<div bind:this={anchor} class="contents">
	{#if isOpen}
		<div
			data-find-exclude
			class="sticky top-0 z-20 flex flex-shrink-0 items-center gap-2 border-b border-stone-200 bg-white px-3 py-1.5 shadow-sm"
			role="search"
			aria-label="Find in {mode === 'editor' ? 'note' : 'week'}"
			data-testid="find-bar"
		>
			<input
				bind:this={input}
				bind:value={query}
				oninput={handleInput}
				onkeydown={handleInputKeydown}
				type="search"
				placeholder="Find in {mode === 'editor' ? 'note' : 'this week'}"
				aria-label="Find in page"
				class="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none sm:max-w-xs"
				data-testid="find-input"
			/>
			<span class="min-w-[5rem] shrink-0 text-xs max-sm:min-w-0 tabular-nums text-stone-500" aria-live="polite" data-testid="find-count">{countLabel}</span>
			<button type="button" onclick={() => move(-1)} disabled={matchCount === 0} class="rounded px-2 py-1 text-stone-600 hover:bg-stone-100 disabled:opacity-40 pointer-coarse:min-h-11 pointer-coarse:min-w-11" aria-label="Previous match" title="Previous (Shift+Enter)" data-testid="find-previous">↑</button>
			<button type="button" onclick={() => move(1)} disabled={matchCount === 0} class="rounded px-2 py-1 text-stone-600 hover:bg-stone-100 disabled:opacity-40 pointer-coarse:min-h-11 pointer-coarse:min-w-11" aria-label="Next match" title="Next (Enter)" data-testid="find-next">↓</button>
			<button type="button" onclick={() => close()} class="rounded px-2 py-1 text-stone-500 hover:bg-stone-100 pointer-coarse:min-h-11 pointer-coarse:min-w-11" aria-label="Close find" title="Close (Escape)" data-testid="find-close">✕</button>
		</div>
	{/if}
</div>
