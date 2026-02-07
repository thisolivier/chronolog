<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';
	import Placeholder from '@tiptap/extension-placeholder';
	import { Markdown } from 'tiptap-markdown';
	import EditorToolbar from './EditorToolbar.svelte';

	interface Props {
		initialContent?: string;
		initialJson?: string;
		noteTitle?: string;
		onSave?: (data: { title: string; content: string; contentJson: string }) => void;
		onTitleChange?: (title: string) => void;
		readonly?: boolean;
	}

	let {
		initialContent = '',
		initialJson = '',
		noteTitle = '',
		onSave,
		onTitleChange,
		readonly = false
	}: Props = $props();

	let editorElement: HTMLDivElement;
	let editor: Editor | null = $state(null);
	let title = $state(noteTitle);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;

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
				StarterKit,
				Link.configure({ openOnClick: false }),
				Placeholder.configure({ placeholder: 'Start writing...' }),
				Markdown
			],
			content,
			editable: !readonly,
			onTransaction: () => {
				// Force Svelte reactivity update for toolbar state
				editor = editor;
			},
			onUpdate: () => {
				triggerDebouncedsave();
			}
		});
	});

	onDestroy(() => {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
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

	<!-- Toolbar -->
	{#if !readonly}
		<EditorToolbar {editor} />
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
</style>
