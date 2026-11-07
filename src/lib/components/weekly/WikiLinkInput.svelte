<script lang="ts" module>
    let wikiLinkInputCount = 0;
</script>

<script lang="ts">
    import { tick } from 'svelte';
    import LinkPicker from '$lib/components/search/LinkPicker.svelte';
    import { createLinkPickerSearch, type LinkPickerSearch } from '$lib/components/search/link-picker-search.svelte';
    import { placeLinkPicker } from '$lib/components/search/link-picker-placement';
    import type { LinkPickerItem } from '$lib/components/search/link-targets';

    interface Props {
        value: string;
        placeholder?: string;
        onInput?: (value: string) => void;
        onBlur?: () => void;
        onKeydown?: (event: KeyboardEvent) => void;
        autofocus?: boolean;
        /**
         * A textarea that grows to its text (sprint 057-DR, TR-06), for editing a saved entry's
         * description in place without collapsing it to one line. Enter is still the parent's
         * (it saves); the text wraps instead of scrolling sideways.
         */
        multiline?: boolean;
        /** Extra classes for the field (the entry row matches its read-mode text) */
        fieldClass?: string;
        ariaLabel?: string;
    }

    let {
        value = $bindable(),
        placeholder = '',
        onInput,
        onBlur,
        onKeydown,
        autofocus = false,
        multiline = false,
        fieldClass = '',
        ariaLabel = undefined
    }: Props = $props();

    let inputElement: HTMLInputElement | HTMLTextAreaElement | undefined = $state();

    // Focus on mount when asked (instead of the autofocus attribute, which a11y lint flags),
    // with the caret at the end of the text
    $effect(() => {
        if (!autofocus || !inputElement) return;
        inputElement.focus();
        const end = inputElement.value.length;
        inputElement.setSelectionRange(end, end);
    });

    /** Grow the textarea to its content (no scrollbar, no collapse to one line) */
    function fitToContent() {
        if (!multiline || !inputElement) return;
        inputElement.style.height = 'auto';
        inputElement.style.height = `${inputElement.scrollHeight}px`;
    }

    $effect(() => {
        void value;
        fitToContent();
    });
    // The `[[` picker: the shared list, querying and placement of the note editor (059-DR,
    // SR-04..SR-07). An empty `[[` lists recent notes; rows carry the contract mark and
    // client / contract; replies to older queries are ignored; Enter while the current query is
    // still loading inserts from its reply, never from the rows left over from the previous one.
    const PHONE_QUERY = '(max-width: 767px)';
    const idPrefix = `entry-link-${++wikiLinkInputCount}`;

    let isPickerOpen = $state(false);
    let activeIndex = $state(0);
    let bracketStartIndex = $state(-1);
    let pickerVariant = $state<'desktop' | 'phone'>('desktop');
    let pickerPlacement = $state<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
    let pickerLayer: HTMLDivElement | undefined = $state();
    let search: LinkPickerSearch | null = $state(null);
    let enterPending = false;
    let lastItems: LinkPickerItem[] = [];

    function syncFromSearch() {
        if (!search) return;
        if (search.items !== lastItems) {
            lastItems = search.items;
            activeIndex = 0;
        }
        if (enterPending && search.status !== 'loading') {
            enterPending = false;
            if (search.status === 'ready' && search.items[activeIndex]) {
                selectResult(activeIndex);
                return;
            }
        }
        void tick().then(positionPicker);
    }

    function openPicker(query: string) {
        if (!search) {
            pickerVariant = window.matchMedia(PHONE_QUERY).matches ? 'phone' : 'desktop';
            lastItems = [];
            activeIndex = 0;
            search = createLinkPickerSearch({ onChange: syncFromSearch });
        }
        isPickerOpen = true;
        // Typing on after Enter means the earlier Enter no longer applies
        if (query !== search.query) enterPending = false;
        search.setQuery(query);
        void tick().then(positionPicker);
    }

    function closePicker() {
        isPickerOpen = false;
        enterPending = false;
        search?.dispose();
        search = null;
        pickerPlacement = null;
    }

    $effect(() => () => closePicker());

    /** Place the list against the visual viewport (above a phone's keyboard), anchored to the field */
    function positionPicker() {
        if (!isPickerOpen || !inputElement) return;
        const visual = window.visualViewport;
        const viewport = visual
            ? { top: visual.offsetTop, left: visual.offsetLeft, width: visual.width, height: visual.height }
            : { top: 0, left: 0, width: document.documentElement.clientWidth, height: window.innerHeight };
        const panel = pickerLayer?.firstElementChild as HTMLElement | null | undefined;
        const list = panel?.querySelector<HTMLElement>('[role="listbox"]');
        const contentHeight = panel && list ? panel.offsetHeight - list.clientHeight + list.scrollHeight : 0;
        pickerPlacement = placeLinkPicker({
            anchor: inputElement.getBoundingClientRect(),
            viewport,
            contentHeight,
            isPhone: pickerVariant === 'phone'
        });
    }

    $effect(() => {
        if (!isPickerOpen) return;
        const reposition = () => positionPicker();
        const visual = window.visualViewport;
        visual?.addEventListener('resize', reposition);
        visual?.addEventListener('scroll', reposition);
        window.addEventListener('resize', reposition);
        document.addEventListener('scroll', reposition, { capture: true, passive: true });
        return () => {
            visual?.removeEventListener('resize', reposition);
            visual?.removeEventListener('scroll', reposition);
            window.removeEventListener('resize', reposition);
            document.removeEventListener('scroll', reposition, { capture: true });
        };
    });

    /** The list lives on <body>: the entry rows' container queries would otherwise hold a fixed box */
    function portal(node: HTMLElement) {
        document.body.appendChild(node);
        return { destroy: () => node.remove() };
    }

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
     * Insert the chosen note's ID into the text, replacing the [[query portion.
     */
    function selectResult(index: number) {
        const item = search?.items[index];
        if (!item) return;
        const noteId = item.noteId;
        const beforeBrackets = value.slice(0, bracketStartIndex);
        const cursorPosition = inputElement?.selectionStart ?? value.length;
        const afterCursor = value.slice(cursorPosition);

        const newValue = `${beforeBrackets}[[${noteId}]]${afterCursor}`;
        value = newValue;
        onInput?.(newValue);

        closePicker();

        // Set cursor after the inserted link
        const newCursorPos = beforeBrackets.length + noteId.length + 4; // [[ + noteId + ]]
        requestAnimationFrame(() => {
            inputElement?.setSelectionRange(newCursorPos, newCursorPos);
            inputElement?.focus();
        });
    }

    function handleInput(event: Event) {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement;
        value = target.value;
        onInput?.(value);

        const detected = detectWikiLinkQuery();
        if (detected) {
            bracketStartIndex = detected.startIndex;
            openPicker(detected.query);
        } else {
            closePicker();
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (isPickerOpen && search) {
            const itemCount = search.items.length;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (itemCount === 0) return;
                const step = event.key === 'ArrowDown' ? 1 : -1;
                activeIndex = Math.min(Math.max(activeIndex + step, 0), itemCount - 1);
                return;
            }
            if (event.key === 'Enter') {
                // Rows still on screen during a load belong to the previous query
                if (search.status === 'loading') {
                    event.preventDefault();
                    enterPending = true;
                    return;
                }
                if (search.items[activeIndex]) {
                    event.preventDefault();
                    selectResult(activeIndex);
                    return;
                }
            }
            if (event.key === 'Escape') {
                // Closes the list and keeps the typed text; the editor stays open
                event.preventDefault();
                closePicker();
                return;
            }
        }

        // Forward to parent
        onKeydown?.(event);
    }

    function handleBlur(event: FocusEvent) {
        // The list prevents mousedown, so a click on a row never blurs the field
        const next = event.relatedTarget as Node | null;
        if (next && pickerLayer?.contains(next)) return;
        closePicker();
        // The parent's blur (TimeEntryCard: save the description) stays deferred: a click that
        // took the focus, such as Attach note, runs first and may take over the typed text
        setTimeout(() => onBlur?.(), 150);
    }
</script>

<div class="relative">
    {#if multiline}
        <textarea
            bind:this={inputElement}
            rows="1"
            {value}
            {placeholder}
            aria-label={ariaLabel}
            aria-autocomplete="list"
            aria-controls={isPickerOpen ? `${idPrefix}-list` : undefined}
            aria-activedescendant={isPickerOpen && search?.items[activeIndex] ? `${idPrefix}-option-${activeIndex}` : undefined}
            oninput={handleInput}
            onkeydown={handleKeydown}
            onblur={handleBlur}
            class="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 focus:ring-0 focus:outline-none {fieldClass}"
        ></textarea>
    {:else}
        <input
            bind:this={inputElement}
            type="text"
            {value}
            {placeholder}
            aria-label={ariaLabel}
            aria-autocomplete="list"
            aria-controls={isPickerOpen ? `${idPrefix}-list` : undefined}
            aria-activedescendant={isPickerOpen && search?.items[activeIndex] ? `${idPrefix}-option-${activeIndex}` : undefined}
            oninput={handleInput}
            onkeydown={handleKeydown}
            onblur={handleBlur}
            class="block w-full border-0 border-b border-divider bg-transparent px-0 py-0.5 text-sm text-ink-muted focus:border-pine-400 focus:ring-0 focus:outline-none {fieldClass}"
        />
    {/if}

    {#if isPickerOpen && search}
        <div
            use:portal
            bind:this={pickerLayer}
            class="fixed z-50"
            style:top={pickerPlacement ? `${pickerPlacement.top}px` : undefined}
            style:left={pickerPlacement ? `${pickerPlacement.left}px` : undefined}
            style:width={pickerPlacement ? `${pickerPlacement.width}px` : undefined}
            style:visibility={pickerPlacement ? undefined : 'hidden'}
            data-link-picker-layer
        >
            <LinkPicker
                items={search.items}
                status={search.status}
                {activeIndex}
                variant={pickerVariant}
                {idPrefix}
                maxHeight={pickerPlacement?.maxHeight}
                onChoose={selectResult}
                onActivate={(index) => (activeIndex = index)}
            />
        </div>
    {/if}
</div>
