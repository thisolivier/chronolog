<!--
	EditorToolbar (054-DR, NT-05). Desktop groups: bold / italic | Normal text, H1, H2, H3 |
	bullet, numbered, checklist | rule, link, code, attachment | Rich / Raw at the right. On a phone
	(`compact`) the core stays visible (bold, italic, a heading choice, bullet list, checklist) and the
	rest moves into a "Formatting" overflow menu (distinct from the header's "Note actions"); "Rich"
	opens the Rich / Raw choice. Every button and menu item keeps the editor's selection: mousedown
	is prevented and each command runs through `chain().focus()`, which restores the selection.
	Active and disabled states follow `transactionCount` (bumped on every TipTap transaction).
-->
<script lang="ts">
	import type { ChainedCommands, Editor } from '@tiptap/core';
	import ToolbarMenu from './ToolbarMenu.svelte';

	type EditorMode = 'rendered' | 'raw';

	interface Props {
		editor: Editor | null;
		/** Bumped by NoteEditor on every TipTap transaction so active states re-evaluate */
		transactionCount?: number;
		onAttachFile?: () => void;
		editorMode?: EditorMode;
		onSetEditorMode?: (mode: EditorMode) => void;
		/** Phone layout: core formatting plus overflow menus */
		compact?: boolean;
	}

	let { editor, transactionCount = 0, onAttachFile, editorMode = 'rendered', onSetEditorMode, compact = false }: Props = $props();

	type ToolSpec = {
		key: string;
		label: string;
		title: string;
		ariaLabel?: string;
		run: () => void;
		can?: (chain: ChainedCommands) => ChainedCommands;
		/** Disabled unless the editor exists (commands without a `can` check) */
		needsOnly?: 'editor' | 'attach';
		active?: () => boolean;
		extraClass?: string;
		dataTaskList?: boolean;
	};

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

	function isDisabled(tool: ToolSpec): boolean {
		if (tool.needsOnly === 'attach') return !editor || !onAttachFile;
		if (tool.needsOnly === 'editor' || !tool.can) return !editor;
		return !canRun(tool.can);
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
		editor?.chain().focus().toggleHeading({ level }).run();
	}

	/** The phone's heading menu picks a style outright (no toggling back) */
	function setTextStyle(level: 0 | 1 | 2 | 3) {
		if (!editor) return;
		if (level === 0) editor.chain().focus().setParagraph().run();
		else editor.chain().focus().setHeading({ level }).run();
	}

	const currentHeadingLevel = $derived.by((): 0 | 1 | 2 | 3 => {
		void transactionCount;
		for (const level of [1, 2, 3] as const) if (editor?.isActive('heading', { level })) return level;
		return 0;
	});

	const bold: ToolSpec = {
		key: 'bold', label: 'B', title: 'Bold (⌘B)', extraClass: 'font-semibold',
		run: () => editor?.chain().focus().toggleBold().run(), can: (chain) => chain.toggleBold(), active: () => isActive('bold')
	};
	const italic: ToolSpec = {
		key: 'italic', label: 'I', title: 'Italic (⌘I)', extraClass: 'italic font-serif',
		run: () => editor?.chain().focus().toggleItalic().run(), can: (chain) => chain.toggleItalic(), active: () => isActive('italic')
	};
	const normalText: ToolSpec = {
		key: 'paragraph', label: '¶', title: 'Normal text', ariaLabel: 'Normal text',
		run: () => setTextStyle(0), can: (chain) => chain.setParagraph(), active: () => isActive('paragraph')
	};
	const headings: ToolSpec[] = ([1, 2, 3] as const).map((level) => ({
		key: `h${level}`, label: `H${level}`, title: `Heading ${level}`,
		run: () => toggleHeading(level), can: (chain) => chain.toggleHeading({ level }), active: () => isActive('heading', { level })
	}));
	const bulletList: ToolSpec = {
		key: 'bullet', label: '•', title: 'Bullet List', ariaLabel: 'Bullet List',
		run: () => editor?.chain().focus().toggleBulletList().run(), can: (chain) => chain.toggleBulletList(), active: () => isActive('bulletList')
	};
	const orderedList: ToolSpec = {
		key: 'ordered', label: '1.', title: 'Ordered List', ariaLabel: 'Ordered List',
		run: () => editor?.chain().focus().toggleOrderedList().run(), can: (chain) => chain.toggleOrderedList(), active: () => isActive('orderedList')
	};
	const taskList: ToolSpec = {
		key: 'task', label: '☑', title: 'Task List (type [ ] at the start of a line)', ariaLabel: 'Task List', dataTaskList: true,
		run: () => editor?.chain().focus().toggleTaskList().run(), can: (chain) => chain.toggleTaskList(), active: () => isActive('taskList')
	};
	const rule: ToolSpec = {
		key: 'rule', label: '—', title: 'Horizontal Rule', ariaLabel: 'Horizontal Rule',
		run: () => editor?.chain().focus().setHorizontalRule().run(), can: (chain) => chain.setHorizontalRule()
	};
	const link: ToolSpec = {
		key: 'link', label: 'Link', title: 'Link', needsOnly: 'editor', run: handleLink, active: () => isActive('link')
	};
	const codeBlock: ToolSpec = {
		key: 'code', label: '</>', title: 'Code Block', ariaLabel: 'Code Block', needsOnly: 'editor', extraClass: 'font-mono text-xs',
		run: () => editor?.chain().focus().toggleCodeBlock().run(), active: () => isActive('codeBlock')
	};
	const attach: ToolSpec = {
		key: 'attach', label: 'Attach', title: 'Attach file', needsOnly: 'attach', run: () => onAttachFile?.()
	};

	const desktopGroups: ToolSpec[][] = [
		[bold, italic],
		[normalText, ...headings],
		[bulletList, orderedList, taskList],
		[rule, link, codeBlock, attach]
	];
	/** Phone: what stays visible beside the heading choice, and what goes into "Formatting" */
	const compactVisible: ToolSpec[] = [bulletList, taskList];
	const compactOverflow: ToolSpec[] = [orderedList, rule, link, codeBlock, attach];

	// Disabled (060-DR): the ink-fainter colour at full strength (about 2.7:1, legible) instead of
	// faded ink-muted (about 2.2:1); no hover fill, so it reads as unavailable
	const buttonClass =
		'shrink-0 rounded px-2.5 py-1 text-sm transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11 disabled:cursor-not-allowed disabled:text-ink-fainter disabled:hover:bg-transparent';
	const idleClass = 'text-ink-muted hover:bg-chalk-100';
	const activeClass = 'bg-pine-100 text-pine-700 font-semibold';
	const menuItemClass = 'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm menu-item pointer-coarse:py-3 disabled:cursor-not-allowed disabled:text-ink-fainter';
	const headingNames = ['Normal text', 'Heading 1', 'Heading 2', 'Heading 3'] as const;
</script>

{#snippet toolButton(tool: ToolSpec)}
	<button
		type="button"
		onmousedown={(event) => event.preventDefault()}
		onclick={tool.run}
		disabled={isDisabled(tool)}
		class="{buttonClass} {tool.active?.() ? activeClass : idleClass} {tool.extraClass ?? ''}"
		title={tool.title}
		aria-label={tool.ariaLabel}
		aria-pressed={tool.active ? tool.active() : undefined}
		data-toolbar-task-list={tool.dataTaskList ? '' : undefined}
		data-toolbar-tool={tool.key}
	>
		{tool.label}
	</button>
{/snippet}

{#snippet divider()}
	<span class="mx-0.5 h-5 w-px shrink-0 self-center bg-chalk-300" aria-hidden="true"></span>
{/snippet}

<div class="flex items-center gap-1 bg-chalk-50 px-2 py-1.5 {compact ? 'flex-nowrap' : 'flex-wrap'}" data-testid="editor-toolbar">
	{#if !compact}
		{#each desktopGroups as group, groupIndex (groupIndex)}
			{#if groupIndex > 0}{@render divider()}{/if}
			<div class="flex items-center gap-0.5" role="group">
				{#each group as tool (tool.key)}{@render toolButton(tool)}{/each}
			</div>
		{/each}
		<!-- Rich / Raw: a two-way switch at the right (also when the groups wrap) -->
		<div class="ml-auto flex shrink-0 rounded-md border border-divider p-0.5" role="group" aria-label="Editor view" data-testid="editor-mode-switch">
			{#each [['rendered', 'Rich', 'Rich text'], ['raw', 'Raw', 'Raw markdown']] as const as [mode, modeLabel, modeTitle] (mode)}
				<button
					type="button"
					onmousedown={(event) => event.preventDefault()}
					onclick={() => onSetEditorMode?.(mode)}
					aria-pressed={editorMode === mode}
					title={modeTitle}
					class="rounded px-2.5 py-0.5 text-xs pointer-coarse:min-h-11 {editorMode === mode
						? 'bg-moss-100 font-semibold text-pine-700'
						: 'text-ink-faint hover:bg-chalk-100'}"
				>
					{modeLabel}
				</button>
			{/each}
		</div>
	{:else}
		{@render toolButton(bold)}
		{@render toolButton(italic)}
		{@render divider()}
		<ToolbarMenu
			label="Text style"
			title="Text style: {headingNames[currentHeadingLevel]}"
			testId="toolbar-heading"
			triggerClass="{buttonClass} {idleClass} flex items-center gap-0.5"
		>
			{#snippet trigger()}
				<span class={currentHeadingLevel ? 'font-semibold text-pine-700' : ''}>{currentHeadingLevel ? `H${currentHeadingLevel}` : 'Text'}</span>
				<span class="text-[10px] text-ink-faint" aria-hidden="true">▾</span>
			{/snippet}
			{#snippet items()}
				{#each [0, 1, 2, 3] as const as level (level)}
					<button
						type="button"
						role="menuitemradio"
						aria-checked={currentHeadingLevel === level}
						onclick={() => setTextStyle(level)}
						disabled={!editor}
						class="{menuItemClass} {currentHeadingLevel === level ? 'font-semibold text-pine-700' : ''}"
					>
						{headingNames[level]}
					</button>
				{/each}
			{/snippet}
		</ToolbarMenu>
		{@render divider()}
		{#each compactVisible as tool (tool.key)}{@render toolButton(tool)}{/each}
		<ToolbarMenu label="Formatting" title="More formatting" testId="toolbar-formatting" alignRight triggerClass="{buttonClass} {idleClass}">
			{#snippet trigger()}
				<svg viewBox="0 0 20 20" fill="currentColor" class="mx-auto h-4 w-4" aria-hidden="true">
					<circle cx="4.5" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="15.5" cy="10" r="1.5" />
				</svg>
			{/snippet}
			{#snippet items()}
				{#each compactOverflow as tool (tool.key)}
					<button
						type="button"
						role="menuitem"
						onclick={tool.run}
						disabled={isDisabled(tool)}
						data-toolbar-tool={tool.key}
						class="{menuItemClass} {tool.active?.() ? 'font-semibold text-pine-700' : ''}"
					>
						<span class="w-6 text-center text-ink-faint {tool.extraClass ?? ''}" aria-hidden="true">{tool.label.length <= 3 ? tool.label : ''}</span>
						{tool.title.replace(' (type [ ] at the start of a line)', '')}
					</button>
				{/each}
			{/snippet}
		</ToolbarMenu>
		<span class="min-w-1 flex-1" aria-hidden="true"></span>
		<ToolbarMenu
			label="Editor view"
			title="Rich text or raw markdown"
			testId="toolbar-editor-view"
			alignRight
			triggerClass="flex shrink-0 items-center gap-0.5 rounded-md border border-divider px-2.5 py-1 text-xs pointer-coarse:min-h-11 {editorMode === 'raw'
				? 'bg-moss-100 font-semibold text-pine-700'
				: 'text-ink-muted'}"
		>
			{#snippet trigger()}
				{editorMode === 'raw' ? 'Raw' : 'Rich'}<span class="text-[10px] text-ink-faint" aria-hidden="true">▾</span>
			{/snippet}
			{#snippet items()}
				{#each [['rendered', 'Rich text'], ['raw', 'Raw markdown']] as const as [mode, modeLabel] (mode)}
					<button
						type="button"
						role="menuitemradio"
						aria-checked={editorMode === mode}
						onclick={() => onSetEditorMode?.(mode)}
						class="{menuItemClass} {editorMode === mode ? 'font-semibold text-pine-700' : ''}"
					>
						{modeLabel}
					</button>
				{/each}
			{/snippet}
		</ToolbarMenu>
	{/if}
</div>
