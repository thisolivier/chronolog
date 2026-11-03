<script lang="ts">
	import type { Editor } from '@tiptap/core';

	interface Props {
		editor: Editor | null;
		/** Bumped by NoteEditor on every TipTap transaction so active states re-evaluate */
		transactionCount?: number;
		onAttachFile?: () => void;
	}

	let { editor, transactionCount = 0, onAttachFile }: Props = $props();

	/**
	 * Active-state check that depends on `transactionCount`: the Editor instance
	 * itself never changes identity, so reading the counter here is what makes
	 * the toolbar highlight follow the selection and marks.
	 */
	function isActive(name: string, attributes?: Record<string, unknown>): boolean {
		void transactionCount;
		return editor?.isActive(name, attributes) ?? false;
	}

	function handleLink() {
		if (!editor) return;

		const previousUrl = editor.getAttributes('link').href;
		const url = window.prompt('URL:', previousUrl);

		// Cancelled
		if (url === null) {
			return;
		}

		// Empty string removes the link
		if (url === '') {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}

		// Update link
		editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
	}

	function toggleHeading(level: 1 | 2 | 3) {
		if (!editor) return;
		editor.chain().focus().toggleHeading({ level }).run();
	}
</script>

<div class="flex flex-nowrap gap-1 bg-stone-50 p-2">
	<button
		type="button"
		onclick={() => editor?.chain().focus().toggleBold().run()}
		disabled={!editor || !editor.can().chain().focus().toggleBold().run()}
		class="shrink-0 px-3 py-1.5 text-sm rounded transition-colors
			{isActive('bold') ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-stone-600 hover:bg-stone-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Bold (⌘B)"
	>
		B
	</button>

	<button
		type="button"
		onclick={() => editor?.chain().focus().toggleItalic().run()}
		disabled={!editor || !editor.can().chain().focus().toggleItalic().run()}
		class="shrink-0 px-3 py-1.5 text-sm rounded transition-colors italic
			{isActive('italic') ? 'bg-blue-100 text-blue-700' : 'text-stone-600 hover:bg-stone-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Italic (⌘I)"
	>
		I
	</button>

	<div class="mx-1 w-px shrink-0 bg-stone-300"></div>

	<button
		type="button"
		onclick={() => toggleHeading(1)}
		disabled={!editor || !editor.can().chain().focus().toggleHeading({ level: 1 }).run()}
		class="shrink-0 px-3 py-1.5 text-sm rounded transition-colors
			{isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-stone-600 hover:bg-stone-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Heading 1"
	>
		H1
	</button>

	<button
		type="button"
		onclick={() => toggleHeading(2)}
		disabled={!editor || !editor.can().chain().focus().toggleHeading({ level: 2 }).run()}
		class="shrink-0 px-3 py-1.5 text-sm rounded transition-colors
			{isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-stone-600 hover:bg-stone-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Heading 2"
	>
		H2
	</button>

	<button
		type="button"
		onclick={() => toggleHeading(3)}
		disabled={!editor || !editor.can().chain().focus().toggleHeading({ level: 3 }).run()}
		class="shrink-0 px-3 py-1.5 text-sm rounded transition-colors
			{isActive('heading', { level: 3 }) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-stone-600 hover:bg-stone-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Heading 3"
	>
		H3
	</button>

	<div class="mx-1 w-px shrink-0 bg-stone-300"></div>

	<button
		type="button"
		onclick={() => editor?.chain().focus().toggleBulletList().run()}
		disabled={!editor || !editor.can().chain().focus().toggleBulletList().run()}
		class="shrink-0 px-3 py-1.5 text-sm rounded transition-colors
			{isActive('bulletList') ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-stone-600 hover:bg-stone-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Bullet List"
	>
		•
	</button>

	<button
		type="button"
		onclick={() => editor?.chain().focus().toggleOrderedList().run()}
		disabled={!editor || !editor.can().chain().focus().toggleOrderedList().run()}
		class="shrink-0 px-3 py-1.5 text-sm rounded transition-colors
			{isActive('orderedList') ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-stone-600 hover:bg-stone-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Ordered List"
	>
		1.
	</button>

	<div class="mx-1 w-px shrink-0 bg-stone-300"></div>

	<button
		type="button"
		onclick={() => editor?.chain().focus().setHorizontalRule().run()}
		disabled={!editor || !editor.can().chain().focus().setHorizontalRule().run()}
		class="shrink-0 px-3 py-1.5 text-sm rounded transition-colors text-stone-600 hover:bg-stone-100
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Horizontal Rule"
	>
		—
	</button>

	<button
		type="button"
		onclick={handleLink}
		disabled={!editor}
		class="shrink-0 px-3 py-1.5 text-sm rounded transition-colors
			{isActive('link') ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-stone-600 hover:bg-stone-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Link"
	>
		Link
	</button>

	<button
		type="button"
		onclick={() => editor?.chain().focus().toggleCodeBlock().run()}
		disabled={!editor}
		class="shrink-0 px-3 py-1.5 text-sm rounded transition-colors
			{isActive('codeBlock') ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-stone-600 hover:bg-stone-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Code Block"
	>
		&lt;/&gt;
	</button>

	<div class="mx-1 w-px shrink-0 bg-stone-300"></div>

	<button
		type="button"
		onclick={onAttachFile}
		disabled={!editor || !onAttachFile}
		class="shrink-0 px-3 py-1.5 text-sm rounded transition-colors text-stone-600 hover:bg-stone-100
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Attach file"
	>
		Attach
	</button>
</div>
