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
	import './NoteEditor.css';
	import { attachNoteScrollMemory } from './note-scroll-memory';
	import { WikiLink, type WikiLinkStorage } from './extensions/wiki-link.js';
	import { AnchoredHeading } from './extensions/anchored-heading.js';
	import { AttachmentImage } from './extensions/attachment-image.js';
	import { MarkdownText } from './extensions/markdown-text.js';
	import { TaskListExtensions } from './extensions/task-list.js';
	import { revokeAllTrackedUrls } from './extensions/attachment-resolver.js';
	import { ATTACHMENT_LINK_PROTOCOLS, attachmentHrefFromTarget, openAttachment } from './extensions/attachment-link.js';
	import { AttachmentLinkStatus } from './extensions/attachment-availability.js';
	import { AutosaveController, type SaveStatus, type PersistOptions } from './note-autosave';
	import { extractPreviewLines } from '$lib/utils/extract-preview-lines';
	import { cachedTitlePreviewOptions } from './note-titles.svelte';
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
		/** `element` is the clicked link (anchors the restore prompt for a trashed note) */
		onWikiLinkClick?: (noteId: string, headingAnchor: string | undefined, element: HTMLElement) => void;
		onFileUpload?: (file: File) => Promise<string | null>;
		/** Focus once mounted: true or 'end' puts the caret at the end, 'start' at the top */
		autofocus?: boolean | 'start' | 'end';
		readonly?: boolean;
		/** Phone layout: the toolbar keeps core formatting and moves the rest into menus (054-DR) */
		compactToolbar?: boolean;
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
		readonly = false,
		compactToolbar = false
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
	/** Scroll and caret memory for Back / Forward (054-DR, SH-07) */
	let positionMemory: ReturnType<typeof attachNoteScrollMemory> | null = null;
	let selectionMemoryTimer: ReturnType<typeof setTimeout> | undefined;

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
			title: truncateNoteTitle(extractPreviewLines(contentJson, cachedTitlePreviewOptions).firstLine),
			content: markdown,
			contentJson
		};
	}

	const autosave = new AutosaveController<NoteSaveData>({
		capture: captureSnapshot,
		persist: (snapshot, options) => boundOnSave?.(snapshot, options) ?? Promise.resolve(),
		onStatusChange: (status) => boundOnStatusChange?.(status),
		isConflict: (error) => (error as { status?: number } | null)?.status === 409
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
				// A PDF is a link, [name.pdf](chronolog://attachment/<id>); the trailing space is
				// unlinked so typing after it does not extend the link
				const linkContent = [
					{
						type: 'text',
						marks: [{ type: 'link', attrs: { href: chronologUrl } }],
						text: file.name || 'Attached PDF',
					},
					{ type: 'text', text: ' ' },
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
					// chronolog:// so attachment links (PDFs) survive parsing; they open on click below
					link: { openOnClick: false, protocols: ATTACHMENT_LINK_PROTOCOLS },
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
				// `- [ ]` / `- [x]` checkbox items, nestable (sprint 040-CL)
				...TaskListExtensions,
				// Links to deleted attachments look missing and do not open (sprint 043-CL)
				AttachmentLinkStatus,
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
			},
			onSelectionUpdate: () => {
				clearTimeout(selectionMemoryTimer);
				selectionMemoryTimer = setTimeout(() => positionMemory?.remember(), 300);
			}
		});

		(editor.storage as unknown as Record<string, WikiLinkStorage>).wikiLink.getCurrentNoteId = () =>
			getNoteId();

		if (autofocus && !readonly) {
			editor.commands.focus(autofocus === 'start' ? 'start' : 'end');
		}

		const editorInstance = editor;
		positionMemory = attachNoteScrollMemory({
			element: mountElement,
			getNoteId,
			getSelection: () => ({ from: editorInstance.state.selection.from, to: editorInstance.state.selection.to }),
			setSelection: (selection) => editorInstance.commands.setTextSelection(selection),
			getDocumentSize: () => editorInstance.state.doc.content.size
		});

		// Attachment links (PDFs) open the decrypted file in a new tab; wiki-links navigate
		mountElement.addEventListener('click', (event) => {
			const attachmentHref = attachmentHrefFromTarget(event.target);
			if (attachmentHref) {
				event.preventDefault();
				void openAttachment(attachmentHref);
				return;
			}
			const target = event.target as HTMLElement;
			const wikiLinkElement = target.closest('[data-wiki-link]') as HTMLElement;
			if (wikiLinkElement && onWikiLinkClick) {
				event.preventDefault();
				const noteId = wikiLinkElement.getAttribute('data-note-id');
				const headingAnchor = wikiLinkElement.getAttribute('data-heading-anchor');
				if (noteId) {
					onWikiLinkClick(noteId, headingAnchor ?? undefined, wikiLinkElement);
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
		clearTimeout(selectionMemoryTimer);
		positionMemory?.destroy();
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

	/** The toolbar's Rich / Raw choice (054-DR): switch only when it differs */
	function setEditorMode(mode: 'rendered' | 'raw') {
		if (mode !== editorMode) toggleEditorMode();
	}

	function handleRawInput() {
		markChanged();
	}
</script>

<div class="flex flex-col h-full border border-divider rounded-lg overflow-hidden bg-surface">
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
		<!-- One bottom rule under the toolbar; Rich / Raw sits at its right (054-DR, NT-05). Desktop
		     groups wrap on a narrow panel; the phone's compact toolbar fits and uses menus. -->
		<div class="border-b border-divider bg-chalk-50">
			<EditorToolbar
				{editor}
				{transactionCount}
				onAttachFile={handleAttachFileClick}
				{editorMode}
				onSetEditorMode={setEditorMode}
				compact={compactToolbar}
			/>
		</div>
	{/if}

	<!-- Editor Content -->
	<div class="flex-grow overflow-y-auto">
		{#if editorMode === 'raw'}
			<textarea
				bind:value={rawMarkdownContent}
				oninput={handleRawInput}
				data-raw-markdown
				class="w-full h-full min-h-[300px] p-4 font-mono text-sm resize-none outline-none bg-surface"
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

