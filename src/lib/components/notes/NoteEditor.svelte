<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';
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
		noteTitle?: string;
		noteId?: string;
		onSave?: (data: { title: string; content: string; contentJson: string }) => void;
		onTitleChange?: (title: string) => void;
		onWikiLinkClick?: (noteId: string, headingAnchor?: string) => void;
		onFileUpload?: (file: File) => Promise<string | null>;
		readonly?: boolean;
	}

	/* eslint-disable @typescript-eslint/no-unused-vars */
	let {
		initialContent = '',
		initialJson = '',
		noteTitle = '',
		// noteId is declared in Props for the parent's API contract (used to construct
		// the onFileUpload callback) but is not consumed inside this component.
		noteId,
		onSave,
		onTitleChange,
		onWikiLinkClick,
		onFileUpload,
		readonly = false
	}: Props = $props();
	/* eslint-enable @typescript-eslint/no-unused-vars */

	let editorElement: HTMLDivElement;
	let fileInput: HTMLInputElement;
	let editor: Editor | null = $state(null);
	let title = $state(noteTitle);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;

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
			element: editorElement,
			extensions: [
				StarterKit.configure({ heading: false }),
				AnchoredHeading,
				Link.configure({ openOnClick: false }),
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
				resolveAllChronologImages(editorElement);
			},
			onTransaction: () => {
				// Force Svelte reactivity update for toolbar state
				editor = editor;
			},
			onUpdate: () => {
				// Resolve any newly inserted chronolog:// image URLs
				resolveAllChronologImages(editorElement);
				triggerDebouncedsave();
			}
		});

		// Handle wiki-link clicks
		editorElement.addEventListener('click', (event) => {
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

	function triggerDebouncedsave() {
		if (!editor || !onSave) return;

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
				title,
				content: markdown,
				contentJson: json
			});
		}, 1500);
	}

	function handleTitleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		title = target.value;

		if (onTitleChange) {
			onTitleChange(title);
		}

		// Also trigger save when title changes
		triggerDebouncedsave();
	}

	// Update title when prop changes
	$effect(() => {
		title = noteTitle;
	});
</script>

<div class="flex flex-col h-full border border-gray-200 rounded-lg overflow-hidden bg-white">
	<!-- Title Input -->
	<div class="border-b border-gray-200 p-4">
		<input
			type="text"
			value={title}
			oninput={handleTitleInput}
			placeholder="Untitled"
			{readonly}
			class="w-full text-xl font-bold outline-none border-none bg-transparent
				placeholder:text-gray-400 disabled:cursor-not-allowed disabled:text-gray-600"
		/>
	</div>

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
		<EditorToolbar {editor} onAttachFile={handleAttachFileClick} />
	{/if}

	<!-- Editor Content -->
	<div class="flex-grow overflow-y-auto">
		<div bind:this={editorElement} class="prose prose-sm max-w-none p-4"></div>
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
		background-color: #1f2937;
		color: #f9fafb;
		padding: 1em;
		border-radius: 0.5em;
		overflow-x: auto;
	}

	:global(.tiptap pre code) {
		background-color: transparent;
		padding: 0;
		color: inherit;
	}

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
