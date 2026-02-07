<script lang="ts">
	interface Props {
		noteId: string;
	}

	type AttachmentInfo = {
		id: string;
		filename: string;
		mimeType: string;
		sizeBytes: number;
		createdAt: string;
	};

	let { noteId }: Props = $props();
	let attachmentItems = $state<AttachmentInfo[]>([]);
	async function fetchAttachments() {
		try {
			const response = await fetch(`/api/notes/${noteId}/attachments`);
			if (response.ok) {
				const data = await response.json();
				attachmentItems = data.attachments;
			}
		} catch (fetchError) {
			console.error('Failed to fetch attachments:', fetchError);
		}
	}

	async function deleteAttachment(attachmentId: string) {
		try {
			await fetch(`/api/attachments/${attachmentId}`, {
				method: 'DELETE'
			});
			attachmentItems = attachmentItems.filter(
				(attachment) => attachment.id !== attachmentId
			);
		} catch (deleteError) {
			console.error('Failed to delete attachment:', deleteError);
		}
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
</script>

{#if attachmentItems.length > 0}
	<div class="border-t border-gray-200 bg-white px-6 py-3">
		<h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
			Attachments
		</h4>
		<div class="space-y-1">
			{#each attachmentItems as attachment (attachment.id)}
				<div
					class="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-gray-50"
				>
					<div class="flex items-center gap-2 min-w-0">
						<span class="text-gray-400">{attachment.mimeType.startsWith('image/') ? 'IMG' : 'PDF'}</span>
						<span class="text-gray-700 truncate">{attachment.filename}</span>
						<span class="text-gray-400 whitespace-nowrap">{formatFileSize(attachment.sizeBytes)}</span>
					</div>
					<button
						onclick={() => deleteAttachment(attachment.id)}
						class="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0"
						title="Delete attachment"
					>
						&times;
					</button>
				</div>
			{/each}
		</div>
	</div>
{/if}
