<script lang="ts">
    interface Props {
        value: string;
        placeholder?: string;
        onInput?: (value: string) => void;
        onBlur?: () => void;
        onKeydown?: (event: KeyboardEvent) => void;
        autofocus?: boolean;
    }

    let { value = $bindable(), placeholder = '', onInput, onBlur, onKeydown, autofocus = false }: Props = $props();

    type SearchResult = { id: string; title: string | null };

    let inputElement: HTMLInputElement;
    let showDropdown = $state(false);
    let searchResults = $state<SearchResult[]>([]);
    let selectedIndex = $state(0);
    let searchQuery = $state('');
    let bracketStartIndex = $state(-1);
    let fetchTimer: ReturnType<typeof setTimeout> | undefined;

    /**
     * Detect [[ pattern at cursor position and extract the query.
     */
    function detectWikiLinkQuery(): { query: string; startIndex: number } | null {
        if (!inputElement) return null;

        const cursorPosition = inputElement.selectionStart ?? 0;
        const textBeforeCursor = value.slice(0, cursorPosition);

        // Find the last [[ before cursor that doesn't have a closing ]]
        const lastBracketOpen = textBeforeCursor.lastIndexOf('[[');
        if (lastBracketOpen === -1) return null;

        const textAfterBrackets = textBeforeCursor.slice(lastBracketOpen + 2);

        // If there's a ]] between [[ and cursor, this is a closed link
        if (textAfterBrackets.includes(']]')) return null;

        return {
            query: textAfterBrackets,
            startIndex: lastBracketOpen,
        };
    }

    /**
     * Fetch note search results.
     */
    async function fetchResults(query: string) {
        if (!query || query.length < 1) {
            searchResults = [];
            return;
        }

        try {
            const response = await fetch(`/api/notes/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                searchResults = [];
                return;
            }
            const data = await response.json();
            searchResults = data.notes ?? [];
            selectedIndex = 0;
        } catch {
            searchResults = [];
        }
    }

    /**
     * Insert a selected note ID into the text, replacing the [[query portion.
     */
    function selectResult(result: SearchResult) {
        const noteId = result.id;
        const beforeBrackets = value.slice(0, bracketStartIndex);
        const cursorPosition = inputElement.selectionStart ?? value.length;
        const afterCursor = value.slice(cursorPosition);

        const newValue = `${beforeBrackets}[[${noteId}]]${afterCursor}`;
        value = newValue;
        onInput?.(newValue);

        showDropdown = false;
        searchResults = [];

        // Set cursor after the inserted link
        const newCursorPos = beforeBrackets.length + noteId.length + 4; // [[ + noteId + ]]
        requestAnimationFrame(() => {
            inputElement?.setSelectionRange(newCursorPos, newCursorPos);
            inputElement?.focus();
        });
    }

    function handleInput(event: Event) {
        const target = event.target as HTMLInputElement;
        value = target.value;
        onInput?.(value);

        const detected = detectWikiLinkQuery();
        if (detected) {
            searchQuery = detected.query;
            bracketStartIndex = detected.startIndex;
            showDropdown = true;

            clearTimeout(fetchTimer);
            fetchTimer = setTimeout(() => fetchResults(searchQuery), 200);
        } else {
            showDropdown = false;
            searchResults = [];
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (showDropdown && searchResults.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                selectedIndex = (selectedIndex + 1) % searchResults.length;
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                selectedIndex = (selectedIndex - 1 + searchResults.length) % searchResults.length;
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                selectResult(searchResults[selectedIndex]);
                return;
            }
        }

        if (showDropdown && event.key === 'Escape') {
            event.preventDefault();
            showDropdown = false;
            return;
        }

        // Forward to parent
        onKeydown?.(event);
    }

    function handleBlur() {
        // Delay to allow dropdown click to fire
        setTimeout(() => {
            showDropdown = false;
            onBlur?.();
        }, 150);
    }
</script>

<div class="relative">
    <input
        bind:this={inputElement}
        type="text"
        {value}
        {placeholder}
        oninput={handleInput}
        onkeydown={handleKeydown}
        onblur={handleBlur}
        class="block w-full border-0 border-b border-stone-200 bg-transparent px-0 py-0.5 text-sm text-stone-600 focus:border-blue-400 focus:ring-0 focus:outline-none"
        {autofocus}
    />

    {#if showDropdown}
        <div class="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border border-stone-200 bg-white py-1 shadow-lg">
            {#if searchResults.length === 0}
                <div class="px-3 py-2 text-xs text-stone-400">
                    {searchQuery.length > 0 ? 'No matching notes' : 'Type to search notes...'}
                </div>
            {:else}
                {#each searchResults as result, index (result.id)}
                    <button
                        type="button"
                        class="block w-full px-3 py-1.5 text-left text-sm transition-colors
                            {index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-stone-700 hover:bg-stone-50'}"
                        onmousedown={() => selectResult(result)}
                    >
                        <span class="font-mono text-xs text-stone-400">{result.id}</span>
                        {#if result.title}
                            <span class="ml-1 text-stone-500">&middot;</span>
                            <span class="ml-1">{result.title}</span>
                        {/if}
                    </button>
                {/each}
            {/if}
        </div>
    {/if}
</div>
