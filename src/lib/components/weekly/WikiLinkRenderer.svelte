<script lang="ts">
    import { parseWikiLinkText } from '$lib/components/notes/extensions/wiki-link';
    import { isNoteInTrash, wikiLinkDisplayText } from '$lib/components/notes/note-titles.svelte';
    import { restoreTrashedNote, showRestorePrompt } from '$lib/components/notes/note-trash';
    import { getDataService } from '$lib/services/context';

    const dataService = getDataService();

    /** A link to a note in the trash offers a restore, then opens it (sprint 037-CL) */
    function handleLinkClick(event: MouseEvent, noteId: string, label: string) {
        event.stopPropagation();
        if (!isNoteInTrash(noteId)) {
            onNoteLinkClick?.(noteId);
            return;
        }
        showRestorePrompt(event.currentTarget as HTMLElement, {
            title: wikiLinkDisplayText(noteId, label),
            onRestore: async () => {
                await restoreTrashedNote(dataService, noteId);
                onNoteLinkClick?.(noteId);
            }
        });
    }

    interface Props {
        text: string;
        onNoteLinkClick?: (noteId: string) => void;
    }

    let { text, onNoteLinkClick }: Props = $props();

    type Segment =
        | { type: 'text'; content: string }
        | { type: 'link'; noteId: string; label: string; headingAnchor?: string };

    /**
     * Parse description text into segments of plain text and wiki-links.
     */
    function parseSegments(input: string): Segment[] {
        const segments: Segment[] = [];
        const pattern = /\[\[([^\]]+)\]\]/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(input)) !== null) {
            // Add preceding plain text
            if (match.index > lastIndex) {
                segments.push({ type: 'text', content: input.slice(lastIndex, match.index) });
            }

            // Parse the wiki-link interior
            const parsed = parseWikiLinkText(match[1]);
            segments.push({
                type: 'link',
                noteId: parsed.noteId,
                label: parsed.label,
                headingAnchor: parsed.headingAnchor,
            });

            lastIndex = match.index + match[0].length;
        }

        // Add remaining plain text
        if (lastIndex < input.length) {
            segments.push({ type: 'text', content: input.slice(lastIndex) });
        }

        return segments;
    }

    let segments = $derived(parseSegments(text));
</script>

<span class="wiki-link-rendered">
    {#each segments as segment, segmentIndex (segmentIndex)}
        {#if segment.type === 'text'}
            {segment.content}
        {:else}
            {@const trashed = isNoteInTrash(segment.noteId)}
            <button
                type="button"
                class={trashed
                    ? 'inline cursor-pointer text-stone-400 line-through decoration-stone-300'
                    : 'inline text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300 hover:decoration-indigo-500 cursor-pointer font-medium'}
                data-deleted={trashed ? '' : undefined}
                onclick={(event) => handleLinkClick(event, segment.noteId, segment.label)}
                title={trashed ? `${segment.noteId} (deleted: click to restore)` : segment.noteId}
            >
                <!-- The linked note's title (fetched and cached), the ID until it arrives -->
                {wikiLinkDisplayText(segment.noteId, segment.label)}
            </button>{#if trashed}<span class="text-xs text-stone-400"> (deleted)</span>{/if}
        {/if}
    {/each}
</span>
