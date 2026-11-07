<script lang="ts">
	import type { ChainedCommands, Editor } from '@tiptap/core';

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

	/**
	 * Whether a command can run now (sprint 043-CL): reads `transactionCount` like `isActive`, so the
	 * disabled states follow the selection too instead of being evaluated once.
	 */
	function canRun(command: (chain: ChainedCommands) => ChainedCommands): boolean {
		void transactionCount;
		if (!editor) return false;
		return command(editor.can().chain().focus()).run();
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

<div class="flex flex-nowrap gap-1 bg-chalk-50 p-2">
	<button
		type="button"
		onclick={() => editor?.chain().focus().toggleBold().run()}
		disabled={!canRun((chain) => chain.toggleBold())}
		class="shrink-0 px-3 py-1.5 text-sm rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11 transition-colors
			{isActive('bold') ? 'bg-pine-100 text-pine-700 font-semibold' : 'text-ink-muted hover:bg-chalk-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Bold (⌘B)"
	>
		B
	</button>

	<button
		type="button"
		onclick={() => editor?.chain().focus().toggleItalic().run()}
		disabled={!canRun((chain) => chain.toggleItalic())}
		class="shrink-0 px-3 py-1.5 text-sm rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11 transition-colors italic
			{isActive('italic') ? 'bg-pine-100 text-pine-700' : 'text-ink-muted hover:bg-chalk-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Italic (⌘I)"
	>
		I
	</button>

	<div class="mx-1 w-px shrink-0 bg-chalk-300"></div>

	<button
		type="button"
		onclick={() => toggleHeading(1)}
		disabled={!canRun((chain) => chain.toggleHeading({ level: 1 }))}
		class="shrink-0 px-3 py-1.5 text-sm rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11 transition-colors
			{isActive('heading', { level: 1 }) ? 'bg-pine-100 text-pine-700 font-semibold' : 'text-ink-muted hover:bg-chalk-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Heading 1"
	>
		H1
	</button>

	<button
		type="button"
		onclick={() => toggleHeading(2)}
		disabled={!canRun((chain) => chain.toggleHeading({ level: 2 }))}
		class="shrink-0 px-3 py-1.5 text-sm rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11 transition-colors
			{isActive('heading', { level: 2 }) ? 'bg-pine-100 text-pine-700 font-semibold' : 'text-ink-muted hover:bg-chalk-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Heading 2"
	>
		H2
	</button>

	<button
		type="button"
		onclick={() => toggleHeading(3)}
		disabled={!canRun((chain) => chain.toggleHeading({ level: 3 }))}
		class="shrink-0 px-3 py-1.5 text-sm rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11 transition-colors
			{isActive('heading', { level: 3 }) ? 'bg-pine-100 text-pine-700 font-semibold' : 'text-ink-muted hover:bg-chalk-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Heading 3"
	>
		H3
	</button>

	<div class="mx-1 w-px shrink-0 bg-chalk-300"></div>

	<button
		type="button"
		onclick={() => editor?.chain().focus().toggleBulletList().run()}
		disabled={!canRun((chain) => chain.toggleBulletList())}
		class="shrink-0 px-3 py-1.5 text-sm rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11 transition-colors
			{isActive('bulletList') ? 'bg-pine-100 text-pine-700 font-semibold' : 'text-ink-muted hover:bg-chalk-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Bullet List"
	>
		•
	</button>

	<button
		type="button"
		onclick={() => editor?.chain().focus().toggleOrderedList().run()}
		disabled={!canRun((chain) => chain.toggleOrderedList())}
		class="shrink-0 px-3 py-1.5 text-sm rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11 transition-colors
			{isActive('orderedList') ? 'bg-pine-100 text-pine-700 font-semibold' : 'text-ink-muted hover:bg-chalk-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Ordered List"
	>
		1.
	</button>

	<button
		type="button"
		onclick={() => editor?.chain().focus().toggleTaskList().run()}
		disabled={!canRun((chain) => chain.toggleTaskList())}
		data-toolbar-task-list
		class="shrink-0 px-3 py-1.5 text-sm rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11 transition-colors
			{isActive('taskList') ? 'bg-pine-100 text-pine-700 font-semibold' : 'text-ink-muted hover:bg-chalk-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Task List (type [ ] at the start of a line)"
		aria-label="Task List"
	>
		☑
	</button>

	<div class="mx-1 w-px shrink-0 bg-chalk-300"></div>

	<button
		type="button"
		onclick={() => editor?.chain().focus().setHorizontalRule().run()}
		disabled={!canRun((chain) => chain.setHorizontalRule())}
		class="shrink-0 px-3 py-1.5 text-sm rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11 transition-colors text-ink-muted hover:bg-chalk-100
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Horizontal Rule"
	>
		—
	</button>

	<button
		type="button"
		onclick={handleLink}
		disabled={!editor}
		class="shrink-0 px-3 py-1.5 text-sm rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11 transition-colors
			{isActive('link') ? 'bg-pine-100 text-pine-700 font-semibold' : 'text-ink-muted hover:bg-chalk-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Link"
	>
		Link
	</button>

	<button
		type="button"
		onclick={() => editor?.chain().focus().toggleCodeBlock().run()}
		disabled={!editor}
		class="shrink-0 px-3 py-1.5 text-sm rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11 transition-colors
			{isActive('codeBlock') ? 'bg-pine-100 text-pine-700 font-semibold' : 'text-ink-muted hover:bg-chalk-100'}
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Code Block"
	>
		&lt;/&gt;
	</button>

	<div class="mx-1 w-px shrink-0 bg-chalk-300"></div>

	<button
		type="button"
		onclick={onAttachFile}
		disabled={!editor || !onAttachFile}
		class="shrink-0 px-3 py-1.5 text-sm rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11 transition-colors text-ink-muted hover:bg-chalk-100
			disabled:opacity-50 disabled:cursor-not-allowed"
		title="Attach file"
	>
		Attach
	</button>
</div>
