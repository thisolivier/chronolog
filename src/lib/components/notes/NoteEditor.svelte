<script lang="ts" module>
	export type NoteSaveData = { title: string; content: string; contentJson: string };
</script>

<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
	import { common, createLowlight } from 'lowlight';
	import { FileHandler } from '@tiptap/extension-file-handler';
	import Placeholder from '@tiptap/extension-placeholder';
	import { Markdown } from 'tiptap-markdown';
	import EditorToolbar from './EditorToolbar.svelte';
	import { WikiLink, type WikiLinkStorage } from './extensions/wiki-link.js';
	import { AnchoredHeading } from './extensions/anchored-heading.js';
	import { AttachmentImage } from './extensions/attachment-image.js';
	import { MarkdownText } from './extensions/markdown-text.js';
	import { revokeAllTrackedUrls } from './extensions/attachment-resolver.js';
	import { AutosaveController, type SaveStatus, type PersistOptions } from './note-autosave';
	import { extractPreviewLines } from '$lib/utils/extract-preview-lines';
	import { truncateNoteTitle } from '$lib/utils/note-display-title';

	/** MIME types accepted for file drop/paste */
	const ALLOWED_IMAGE_MIME_TYPES = [
		'image/jpeg',
		'image/png',
		'image/gif',
		'image/webp',
		'image/svg+xml',
	];
	const ALLOWED_PDF_MIME_TYPE = 'application/pdf';
	const ALL_ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_MIME_TYPES, ALLOWED_PDF_MIME_TYPE];

	interface Props {
		initialContent?: string;
		initialJson?: string;
		/**
		 * Returns the ID of the note being edited (null for an unsaved draft). A function so
		 * a draft that gets created keeps the same editor; used to exclude it from `[[`.
		 */
		getNoteId?: () => string | null;
		/** Persist a snapshot; reject on failure so the autosave retries. */
		onSave?: (data: NoteSaveData, options: PersistOptions) => Promise<void>;
		onSaveStatusChange?: (status: SaveStatus) => void;
		onWikiLinkClick?: (noteId: string, headingAnchor?: string) => void;
		onFileUpload?: (file: File) => Promise<string | null>;
		autofocus?: boolean;
		readonly?: boolean;
	}

	let {
		initialContent = '',
		initialJson = '',
		getNoteId = () => null,
		onSave,
		onSaveStatusChange,
		onWikiLinkClick,
		onFileUpload,
		autofocus = false,
		readonly = false
	}: Props = $props();

	// The editor mount point stays in the DOM for the lifetime of the component (it is
	// hidden, not removed, in raw mode) because TipTap keeps a reference to the element
	// it was mounted into. `undefined` until mounted, hence the guards below.
	let editorElement = $state<HTMLDivElement>();
	let fileInput: HTMLInputElement;
	let editor: Editor | null = $state(null);
	// Incremented after every TipTap transaction so the toolbar's active states
	// re-evaluate; the Editor instance itself never changes identity.
	let transactionCount = $state(0);

	let editorMode: 'rendered' | 'raw' = $state('rendered');
	let rawMarkdownContent: string = $state('');
	let isSyncingFromRaw = false;

	// The save callbacks are bound once: a flush during teardown must save to the note
	// this editor was opened for, even if the parent has already moved on.
	const boundOnSave = untrack(() => onSave);
	const boundOnStatusChange = untrack(() => onSaveStatusChange);

	/** Snapshot of the editor (or the raw textarea, in raw mode) for saving. */
	function captureSnapshot(): NoteSaveData {
		if (!editor) throw new Error('Editor not ready');
		if (editorMode === 'raw') {
			// Sync raw markdown into TipTap (silently) to get matching JSON
			isSyncingFromRaw = true;
			editor.commands.setContent(rawMarkdownContent);
			isSyncingFromRaw = false;
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const markdown: string = editorMode === 'raw' ? rawMarkdownContent : (editor.storage as any).markdown.getMarkdown();
		const contentJson = JSON.stringify(editor.getJSON());
		return {
			// The title is the note's first line, so links, search and exports can name it
			title: truncateNoteTitle(extractPreviewLines(contentJson).firstLine),
			content: markdown,
			contentJson
		};
	}

	const autosave = new AutosaveController<NoteSaveData>({
		capture: captureSnapshot,
		persist: (snapshot, options) => boundOnSave?.(snapshot, options) ?? Promise.resolve(),
		onStatusChange: (status) => boundOnStatusChange?.(status)
	});

	function markChanged() {
		if (!boundOnSave || isSyncingFromRaw) return;
		autosave.markDirty();
	}

	/** Save straight away; used by the parent before export or navigation. */
	export function flushPendingSave(): Promise<void> {
		return autosave.flush();
	}

	function handleVisibilityChange() {
		if (document.visibilityState === 'hidden') void autosave.flush({ keepalive: true });
	}

	function handlePageHide() {
		void autosave.flush({ keepalive: true });
	}

	function handleBeforeUnload(event: BeforeUnloadEvent) {
		void autosave.flush({ keepalive: true });
		// Only a save that already failed (e.g. offline) is worth a "leave page?" prompt;
		// the keepalive request above covers the normal case.
		if (autosave.status === 'error') {
			event.preventDefault();
		}
	}

	function handleAttachFileClick() {
		fileInput?.click();
	}

	async function handleFileInputChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target.files;
		if (!files || !editor) return;

		await processUploadedFiles(editor, Array.from(files));

		// Reset input so the same file can be selected again
		target.value = '';
	}

	/**
	 * Check whether a MIME type is an image type (as opposed to PDF).
	 */
	function isImageMimeType(mimeType: string): boolean {
		return ALLOWED_IMAGE_MIME_TYPES.includes(mimeType);
	}
	/**
	 * Process uploaded files: call onFileUpload for each, then insert into editor.
	 * For images, inserts an inline image node. For PDFs, inserts a link.
	 */
	async function processUploadedFiles(
		editorInstance: Editor,
		files: File[],
		insertPosition?: number,
	): Promise<void> {
		if (!onFileUpload) return;

		for (const file of files) {
			const chronologUrl = await onFileUpload(file);
			if (!chronologUrl) continue;

			if (isImageMimeType(file.type)) {
				// Insert image node at the specified position or current cursor
				if (insertPosition !== undefined) {
					editorInstance
						.chain()
						.focus()
						.insertContentAt(insertPosition, {
							type: 'image',
							attrs: { src: chronologUrl, alt: file.name },
						})
						.run();
				} else {
					editorInstance
						.chain()
						.focus()
						.setImage({ src: chronologUrl, alt: file.name })
						.run();
				}
			} else if (file.type === ALLOWED_PDF_MIME_TYPE) {
				// Insert a link for PDFs
				const linkContent = [
					{
						type: 'text',
						marks: [{ type: 'link', attrs: { href: chronologUrl } }],
						text: file.name || 'Attached PDF',
					},
				];

				if (insertPosition !== undefined) {
					editorInstance
						.chain()
						.focus()
						.insertContentAt(insertPosition, linkContent)
						.run();
				} else {
					editorInstance
						.chain()
						.focus()
						.insertContent(linkContent)
						.run();
				}
			}
		}
	}


	onMount(() => {
		const mountElement = editorElement;
		if (!mountElement) return;

		// Determine initial content
		let content: string | Record<string, unknown> = '';
		if (initialJson) {
			try {
				content = JSON.parse(initialJson);
			} catch (error) {
				console.error('Failed to parse initial JSON:', error);
				content = initialContent;
			}
		} else if (initialContent) {
			content = initialContent;
		}

		editor = new Editor({
			element: mountElement,
			extensions: [
				// StarterKit v3 bundles Link, so its options are passed here rather than
				// registering @tiptap/extension-link a second time (duplicate name 'link').
				// `text` is replaced by MarkdownText (no `&gt;` in saved markdown).
				StarterKit.configure({
					heading: false,
					codeBlock: false,
					text: false,
					link: { openOnClick: false },
				}),
				MarkdownText,
				CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
				AnchoredHeading,
				AttachmentImage.configure({ inline: true, allowBase64: false }),
				FileHandler.configure({
					allowedMimeTypes: ALL_ALLOWED_MIME_TYPES,
					onDrop: (currentEditor: Editor, files: File[], dropPosition: number) => {
						processUploadedFiles(currentEditor, files, dropPosition);
					},
					onPaste: (currentEditor: Editor, files: File[]) => {
						processUploadedFiles(currentEditor, files);
					},
				}),
				Placeholder.configure({ placeholder: 'Start writing...' }),
				Markdown,
				WikiLink,
			],
			content,
			editable: !readonly,
			onTransaction: () => {
				// Deferred so the state write never happens inside a Svelte derived/template
				// evaluation (the old `editor = editor` hack raised `state_unsafe_mutation`
				// when a transaction fired during wiki-link navigation, and was a no-op anyway
				// because the Editor instance keeps the same identity).
				queueMicrotask(() => {
					transactionCount += 1;
				});
			},
			onUpdate: () => {
				markChanged();
			}
		});

		(editor.storage as unknown as Record<string, WikiLinkStorage>).wikiLink.getCurrentNoteId = () =>
			getNoteId();

		if (autofocus && !readonly) {
			editor.commands.focus('end');
		}

		// Handle wiki-link clicks
		mountElement.addEventListener('click', (event) => {
			const target = event.target as HTMLElement;
			const wikiLinkElement = target.closest('[data-wiki-link]') as HTMLElement;
			if (wikiLinkElement && onWikiLinkClick) {
				event.preventDefault();
				const noteId = wikiLinkElement.getAttribute('data-note-id');
				const headingAnchor = wikiLinkElement.getAttribute('data-heading-anchor');
				if (noteId) {
					onWikiLinkClick(noteId, headingAnchor ?? undefined);
				}
			}
		});

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('pagehide', handlePageHide);
		window.addEventListener('beforeunload', handleBeforeUnload);
	});

	onDestroy(() => {
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		window.removeEventListener('pagehide', handlePageHide);
		window.removeEventListener('beforeunload', handleBeforeUnload);
		// Capture and save anything typed since the last save BEFORE the editor goes away
		// (note switch, contract switch, layout change, navigation).
		// keepalive: the user may be reloading or closing right after leaving the note.
		if (editor) void autosave.dispose({ keepalive: true });
		// Clean up all blob URLs created by the attachment resolver
		revokeAllTrackedUrls();
		editor?.destroy();
	});

	function toggleEditorMode() {
		if (!editor) return;

		if (editorMode === 'rendered') {
			// Switch to raw: extract markdown from TipTap
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			rawMarkdownContent = (editor.storage as any).markdown.getMarkdown();
			editorMode = 'raw';
		} else {
			// Switch to rendered: parse raw markdown back into TipTap
			isSyncingFromRaw = true;
			editor.commands.setContent(rawMarkdownContent);
			isSyncingFromRaw = false;
			editorMode = 'rendered';
		}
	}

	function handleRawInput() {
		markChanged();
	}
</script>

<div class="flex flex-col h-full border border-stone-200 rounded-lg overflow-hidden bg-white">
	<!-- Hidden file input for the toolbar Attach button -->
	<input
		bind:this={fileInput}
		type="file"
		accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf"
		multiple
		class="hidden"
		onchange={handleFileInputChange}
	/>

	<!-- Toolbar -->
	{#if !readonly}
		<!-- One bottom rule under the toolbar and the Rich toggle; the toolbar scrolls
		     sideways on narrow screens instead of wrapping. -->
		<div class="flex items-center border-b border-stone-200 bg-stone-50">
			<div class="min-w-0 flex-grow overflow-x-auto">
				<EditorToolbar {editor} {transactionCount} onAttachFile={handleAttachFileClick} />
			</div>
			<button
				type="button"
				onclick={toggleEditorMode}
				class="px-3 py-1.5 text-xs rounded transition-colors mx-2 whitespace-nowrap border
					{editorMode === 'raw' ? 'bg-blue-100 text-blue-700 border-blue-200 font-semibold' : 'text-stone-500 hover:bg-stone-100 border-stone-200'}"
				title="Toggle raw markdown view"
			>
				{editorMode === 'raw' ? '◆ Raw' : '◇ Rich'}
			</button>
		</div>
	{/if}

	<!-- Editor Content -->
	<div class="flex-grow overflow-y-auto">
		{#if editorMode === 'raw'}
			<textarea
				bind:value={rawMarkdownContent}
				oninput={handleRawInput}
				data-raw-markdown
				class="w-full h-full min-h-[300px] p-4 font-mono text-sm resize-none outline-none bg-white"
				placeholder="Write markdown here..."
			></textarea>
		{/if}
		<!-- Always mounted: TipTap owns this element, so it is hidden rather than removed in raw mode -->
		<div
			bind:this={editorElement}
			data-note-editor-content
			class={['prose prose-sm max-w-none p-4', editorMode === 'raw' && 'hidden']}
		></div>
	</div>
</div>

<style>
	:global(.tiptap) {
		outline: none;
		min-height: 300px;
		padding: 1rem;
	}

	:global(.tiptap p.is-editor-empty:first-child::before) {
		color: #adb5bd;
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
	}

	/* Ensure proper prose styling */
	:global(.tiptap.ProseMirror) {
		outline: none;
	}

	/* Headings stay modest so a long first line does not become a three-line banner */
	:global(.tiptap h1) {
		font-size: 1.5em;
		line-height: 1.25;
		font-weight: 700;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	:global(.tiptap h2) {
		font-size: 1.25em;
		line-height: 1.3;
		font-weight: 600;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	:global(.tiptap h3) {
		font-size: 1.1em;
		font-weight: 600;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	:global(.tiptap p) {
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	/* Tailwind's preflight removes list markers; restore them (nested lists vary the marker) */
	:global(.tiptap ul),
	:global(.tiptap ol) {
		padding-left: 1.5em;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	:global(.tiptap ul) {
		list-style-type: disc;
	}

	:global(.tiptap ul ul) {
		list-style-type: circle;
	}

	:global(.tiptap ul ul ul) {
		list-style-type: square;
	}

	:global(.tiptap ol) {
		list-style-type: decimal;
	}

	:global(.tiptap ol ol) {
		list-style-type: lower-alpha;
	}

	:global(.tiptap li) {
		margin-top: 0.25em;
		margin-bottom: 0.25em;
	}

	:global(.tiptap li::marker) {
		color: #78716c;
	}

	:global(.tiptap li > p) {
		margin-top: 0;
		margin-bottom: 0;
	}

	:global(.tiptap hr) {
		border: none;
		border-top: 2px solid #e5e7eb;
		margin: 1.5em 0;
	}

	:global(.tiptap a) {
		color: #3b82f6;
		text-decoration: underline;
		cursor: pointer;
	}

	:global(.tiptap a:hover) {
		color: #2563eb;
	}

	:global(.tiptap code) {
		background-color: #f3f4f6;
		padding: 0.2em 0.4em;
		border-radius: 0.25em;
		font-family: monospace;
		font-size: 0.9em;
	}

	:global(.tiptap pre) {
		position: relative;
		background-color: #f6f8fa;
		color: #24292e;
		padding: 0.75rem 1rem;
		border-radius: 0.5em;
		overflow-x: auto;
		border: 1px solid #e1e4e8;
	}

	:global(.tiptap pre code) {
		display: block;
		background-color: transparent;
		padding: 0;
		color: inherit;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	/* highlight.js github-light theme tokens */
	:global(.tiptap pre code .hljs-keyword) { color: #d73a49; }
	:global(.tiptap pre code .hljs-string) { color: #032f62; }
	:global(.tiptap pre code .hljs-comment) { color: #6a737d; font-style: italic; }
	:global(.tiptap pre code .hljs-function) { color: #6f42c1; }
	:global(.tiptap pre code .hljs-number) { color: #005cc5; }
	:global(.tiptap pre code .hljs-title) { color: #6f42c1; }
	:global(.tiptap pre code .hljs-built_in) { color: #e36209; }
	:global(.tiptap pre code .hljs-attr) { color: #005cc5; }
	:global(.tiptap pre code .hljs-selector-tag) { color: #22863a; }
	:global(.tiptap pre code .hljs-selector-class) { color: #6f42c1; }
	:global(.tiptap pre code .hljs-selector-id) { color: #005cc5; }
	:global(.tiptap pre code .hljs-meta) { color: #005cc5; }
	:global(.tiptap pre code .hljs-type) { color: #d73a49; }
	:global(.tiptap pre code .hljs-params) { color: #24292e; }
	:global(.tiptap pre code .hljs-literal) { color: #005cc5; }
	:global(.tiptap pre code .hljs-symbol) { color: #005cc5; }
	:global(.tiptap pre code .hljs-variable) { color: #e36209; }
	:global(.tiptap pre code .hljs-template-variable) { color: #005cc5; }
	:global(.tiptap pre code .hljs-addition) { color: #22863a; background: #f0fff4; }
	:global(.tiptap pre code .hljs-deletion) { color: #b31d28; background: #ffeef0; }

	:global(.tiptap blockquote) {
		border-left: 4px solid #e5e7eb;
		padding-left: 1em;
		margin-left: 0;
		font-style: italic;
		color: #6b7280;
	}

	:global(.tiptap .wiki-link) {
		color: #6366f1;
		background: #eef2ff;
		padding: 1px 4px;
		border-radius: 3px;
		cursor: pointer;
		text-decoration: none;
		font-weight: 500;
	}

	:global(.tiptap .wiki-link:hover) {
		background: #e0e7ff;
		color: #4f46e5;
	}

	/* Inline images */
	:global(.tiptap img) {
		max-width: 100%;
		height: auto;
		border-radius: 0.375rem;
		margin: 0.5em 0;
	}

	/* An attachment that could not be loaded: a visible placeholder instead of a broken icon */
	:global(.tiptap img.attachment-missing) {
		display: inline-block;
		min-width: 8rem;
		min-height: 2rem;
		border: 1px dashed #d6d3d1;
		background: #fafaf9;
	}

	:global(.tiptap img.ProseMirror-selectednode) {
		outline: 2px solid #3b82f6;
	}
</style>
