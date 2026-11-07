<script lang="ts">
	import { getDataService } from '$lib/services/context';
	import type { AttachmentSummary } from '$lib/services/types';
	import { buildChronologUrl } from './extensions/attachment-resolver.js';
	import { openAttachment } from './extensions/attachment-link.js';

	interface Props {
		noteId: string;
	}

	const dataService = getDataService();

	let { noteId }: Props = $props();
	let attachmentItems = $state<AttachmentSummary[]>([]);

	async function fetchAttachments() {
		try {
			attachmentItems = await dataService.getNoteAttachments(noteId);
		} catch (fetchError) {
			console.error('Failed to fetch attachments:', fetchError);
		}
	}

	async function deleteAttachment(attachmentId: string) {
		try {
			await dataService.deleteAttachment(attachmentId);
			attachmentItems = attachmentItems.filter(
				(attachment) => attachment.id !== attachmentId
			);
		} catch (deleteError) {
			console.error('Failed to delete attachment:', deleteError);
		}
	}

	/** Open the decrypted file in a new tab (a PDF in the browser's viewer), like a link in the note */
	function openAttachmentFile(attachmentId: string) {
		void openAttachment(buildChronologUrl(attachmentId));
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) {
			return `${bytes} B`;
		}
		if (bytes < 1024 * 1024) {
			return `${(bytes / 1024).toFixed(1)} KB`;
		}
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	$effect(() => {
		if (noteId) {
			fetchAttachments();
		}
	});

	// Uploads from the editor announce themselves so the list refreshes without a reload
	$effect(() => {
		const handleAttachmentsChanged = (event: Event) => {
			if ((event as CustomEvent<{ noteId: string }>).detail?.noteId === noteId) fetchAttachments();
		};
		window.addEventListener('note-attachments-changed', handleAttachmentsChanged);
		return () => window.removeEventListener('note-attachments-changed', handleAttachmentsChanged);
	});
</script>

{#if attachmentItems.length > 0}
	<div class="border-t border-divider bg-surface px-6 py-3" data-testid="note-attachments">
		<h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
			Attachments
		</h4>
		<div class="space-y-1">
			{#each attachmentItems as attachment (attachment.id)}
				<div
					class="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-chalk-50"
				>
					<div class="flex items-center gap-2 min-w-0" data-testid="attachment-item" data-mime-type={attachment.mimeType}>
						{#if attachment.mimeType.startsWith('image/')}
							<svg class="h-3.5 w-3.5 flex-shrink-0 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Image">
								<rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
							</svg>
						{:else}
							<svg class="h-3.5 w-3.5 flex-shrink-0 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Document">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" />
							</svg>
						{/if}
						{#if attachment.mimeType === 'image/svg+xml'}
							<!-- An SVG is never opened as a page (attachment-link.ts); it shows in the note -->
							<span class="text-ink-soft truncate">{attachment.filename}</span>
						{:else}
							<button
								type="button"
								onclick={() => openAttachmentFile(attachment.id)}
								class="text-ink-soft truncate hover:text-pine-600 hover:underline text-left"
								title="Open {attachment.filename} in a new tab"
							>
								{attachment.filename}
							</button>
						{/if}
						<span class="text-ink-faint whitespace-nowrap" data-testid="attachment-size">{formatFileSize(attachment.sizeBytes)}</span>
					</div>
					<button
						onclick={() => deleteAttachment(attachment.id)}
						class="text-ink-faint hover:text-rust-500 ml-2 flex-shrink-0"
						title="Delete attachment"
					>
						&times;
					</button>
				</div>
			{/each}
		</div>
	</div>
{/if}
