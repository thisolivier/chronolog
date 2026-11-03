<script lang="ts">
    import { parseWikiLinkText } from '$lib/components/notes/extensions/wiki-link';
    import { wikiLinkDisplayText } from '$lib/components/notes/note-titles.svelte';

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
            <button
                type="button"
                class="inline text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300 hover:decoration-indigo-500 cursor-pointer font-medium"
                onclick={(event) => {
                    event.stopPropagation();
                    onNoteLinkClick?.(segment.noteId);
                }}
                title={segment.noteId}
            >
                <!-- The linked note's title (fetched and cached), the ID until it arrives -->
                {wikiLinkDisplayText(segment.noteId, segment.label)}
            </button>
        {/if}
    {/each}
</span>
