<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
	import { common, createLowlight } from 'lowlight';
	import Image from '@tiptap/extension-image';
	import { FileHandler } from '@tiptap/extension-file-handler';
	import Placeholder from '@tiptap/extension-placeholder';
	import { Markdown } from 'tiptap-markdown';
	import EditorToolbar from './EditorToolbar.svelte';
	import { WikiLink } from './extensions/wiki-link.js';
	import { AnchoredHeading } from './extensions/anchored-heading.js';
	import {
		resolveAllChronologImages,
		revokeAllTrackedUrls,
	} from './extensions/attachment-resolver.js';

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
		noteId?: string;
		onSave?: (data: { title: string; content: string; contentJson: string }) => void;
		onWikiLinkClick?: (noteId: string, headingAnchor?: string) => void;
		onFileUpload?: (file: File) => Promise<string | null>;
		readonly?: boolean;
	}

	/* eslint-disable @typescript-eslint/no-unused-vars */
	let {
		initialContent = '',
		initialJson = '',
		// noteId is declared in Props for the parent's API contract (used to construct
		// the onFileUpload callback) but is not consumed inside this component.
		noteId,
		onSave,
		onWikiLinkClick,
		onFileUpload,
		readonly = false
	}: Props = $props();
	/* eslint-enable @typescript-eslint/no-unused-vars */

	// The editor mount point stays in the DOM for the lifetime of the component (it is
	// hidden, not removed, in raw mode) because TipTap keeps a reference to the element
	// it was mounted into. `undefined` until mounted, hence the guards below.
	let editorElement = $state<HTMLDivElement>();
	let fileInput: HTMLInputElement;
	let editor: Editor | null = $state(null);
	// Incremented after every TipTap transaction so the toolbar's active states
	// re-evaluate; the Editor instance itself never changes identity.
	let transactionCount = $state(0);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;

	let editorMode: 'rendered' | 'raw' = $state('rendered');
	let rawMarkdownContent: string = $state('');
	let isSyncingFromRaw = false;

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

	/**
	 * Resolve chronolog:// image URLs inside the editor pane, if it is mounted.
	 */
	function resolveImagesInEditorPane() {
		if (editorElement) {
			resolveAllChronologImages(editorElement);
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
				StarterKit.configure({
					heading: false,
					codeBlock: false,
					link: { openOnClick: false },
				}),
				CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
				AnchoredHeading,
				Image.configure({ inline: true, allowBase64: false }),
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
			onCreate: () => {
				// Resolve any chronolog:// image URLs in the initial content
				resolveImagesInEditorPane();
			},
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
				// Resolve any newly inserted chronolog:// image URLs
				resolveImagesInEditorPane();
				triggerDebouncedsave();
			}
		});

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
	});

	onDestroy(() => {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
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
		if (!onSave) return;

		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}

		saveTimeout = setTimeout(() => {
			if (!editor) return;

			// Sync raw markdown to TipTap (silently) to get matching JSON
			isSyncingFromRaw = true;
			editor.commands.setContent(rawMarkdownContent);
			isSyncingFromRaw = false;

			const json = JSON.stringify(editor.getJSON());

			onSave({
				title: '',
				content: rawMarkdownContent,
				contentJson: json
			});
		}, 500);
	}

	function triggerDebouncedsave() {
		if (!editor || !onSave || isSyncingFromRaw) return;

		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}

		saveTimeout = setTimeout(() => {
			if (!editor) return;

			// Access markdown storage with type assertion
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const markdown = (editor.storage as any).markdown.getMarkdown();
			const json = JSON.stringify(editor.getJSON());

			onSave({
				title: '',
				content: markdown,
				contentJson: json
			});
		}, 500);
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
		<div class="flex items-center">
			<div class="flex-grow overflow-x-auto">
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
				class="w-full h-full p-4 font-mono text-sm resize-none outline-none bg-white"
				placeholder="Write markdown here..."
			></textarea>
		{/if}
		<!-- Always mounted: TipTap owns this element, so it is hidden rather than removed in raw mode -->
		<div
			bind:this={editorElement}
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

	:global(.tiptap h1) {
		font-size: 2em;
		font-weight: 700;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	:global(.tiptap h2) {
		font-size: 1.5em;
		font-weight: 600;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	:global(.tiptap h3) {
		font-size: 1.25em;
		font-weight: 600;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	:global(.tiptap p) {
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	:global(.tiptap ul),
	:global(.tiptap ol) {
		padding-left: 1.5em;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	:global(.tiptap li) {
		margin-top: 0.25em;
		margin-bottom: 0.25em;
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
		padding: 2.5rem 1rem 1rem;
		border-radius: 0.5em;
		overflow-x: auto;
		border: 1px solid #e1e4e8;
	}

	:global(.tiptap pre::before) {
		content: attr(data-language);
		position: absolute;
		top: 0.5rem;
		right: 0.75rem;
		font-size: 0.75rem;
		color: #6a737d;
		text-transform: uppercase;
		font-family: system-ui, sans-serif;
	}

	:global(.tiptap pre code) {
		background-color: transparent;
		padding: 0;
		color: inherit;
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

	:global(.tiptap img.ProseMirror-selectednode) {
		outline: 2px solid #3b82f6;
	}
</style>
