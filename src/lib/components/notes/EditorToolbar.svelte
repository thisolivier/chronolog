<script lang="ts">
	import type { Editor } from '@tiptap/core';

	interface Props {
		editor: Editor | null;
		onAttachFile?: () => void;
	}

	let { editor, onAttachFile }: Props = $props();

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

<div class="border-b bg-gray-50 p-2 flex gap-1 flex-wrap">
	<button
		type="button"
		onclick={() => editor?.chain().focus().toggleBold().run()}
		disabled={!editor || !editor.can().chain().focus().toggleBold().run()}
		class="px-3 py-1.5 text-sm rounded transition-colors
			{editor?.isActive('bold') ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Bold (⌘B)"
	>
		B
	</button>

	<button
		type="button"
		onclick={() => editor?.chain().focus().toggleItalic().run()}
		disabled={!editor || !editor.can().chain().focus().toggleItalic().run()}
		class="px-3 py-1.5 text-sm rounded transition-colors italic
			{editor?.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Italic (⌘I)"
	>
		I
	</button>

	<div class="w-px bg-gray-300 mx-1"></div>

	<button
		type="button"
		onclick={() => toggleHeading(1)}
		disabled={!editor || !editor.can().chain().focus().toggleHeading({ level: 1 }).run()}
		class="px-3 py-1.5 text-sm rounded transition-colors
			{editor?.isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Heading 1"
	>
		H1
	</button>

	<button
		type="button"
		onclick={() => toggleHeading(2)}
		disabled={!editor || !editor.can().chain().focus().toggleHeading({ level: 2 }).run()}
		class="px-3 py-1.5 text-sm rounded transition-colors
			{editor?.isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Heading 2"
	>
		H2
	</button>

	<button
		type="button"
		onclick={() => toggleHeading(3)}
		disabled={!editor || !editor.can().chain().focus().toggleHeading({ level: 3 }).run()}
		class="px-3 py-1.5 text-sm rounded transition-colors
			{editor?.isActive('heading', { level: 3 }) ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Heading 3"
	>
		H3
	</button>

	<div class="w-px bg-gray-300 mx-1"></div>

	<button
		type="button"
		onclick={() => editor?.chain().focus().toggleBulletList().run()}
		disabled={!editor || !editor.can().chain().focus().toggleBulletList().run()}
		class="px-3 py-1.5 text-sm rounded transition-colors
			{editor?.isActive('bulletList') ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Bullet List"
	>
		•
	</button>

	<button
		type="button"
		onclick={() => editor?.chain().focus().toggleOrderedList().run()}
		disabled={!editor || !editor.can().chain().focus().toggleOrderedList().run()}
		class="px-3 py-1.5 text-sm rounded transition-colors
			{editor?.isActive('orderedList') ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Ordered List"
	>
		1.
	</button>

	<div class="w-px bg-gray-300 mx-1"></div>

	<button
		type="button"
		onclick={() => editor?.chain().focus().setHorizontalRule().run()}
		disabled={!editor || !editor.can().chain().focus().setHorizontalRule().run()}
		class="px-3 py-1.5 text-sm rounded transition-colors text-gray-600 hover:bg-gray-100
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Horizontal Rule"
	>
		—
	</button>

	<button
		type="button"
		onclick={handleLink}
		disabled={!editor}
		class="px-3 py-1.5 text-sm rounded transition-colors
			{editor?.isActive('link') ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Link"
	>
		Link
	</button>

	<div class="w-px bg-gray-300 mx-1"></div>

	<button
		type="button"
		onclick={onAttachFile}
		disabled={!editor || !onAttachFile}
		class="px-3 py-1.5 text-sm rounded transition-colors text-gray-600 hover:bg-gray-100
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Attach file"
	>
		Attach
	</button>
</div>
