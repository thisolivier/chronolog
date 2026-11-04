/**
 * The note list's "Search all notes" box (split out of NoteListPanel, sprint 039-CL): a debounced
 * search across every contract; only the latest request's answer is kept.
 */
import type { NoteSearchResult } from '$lib/services/types';

const SEARCH_DEBOUNCE_MS = 200;

export class NoteListSearch {
	query = $state('');
	results = $state<NoteSearchResult[]>([]);
	isSearching = $state(false);
	private timer: ReturnType<typeof setTimeout> | undefined;
	private requestCounter = 0;
	private readonly search: (query: string) => Promise<NoteSearchResult[]>;

	constructor(search: (query: string) => Promise<NoteSearchResult[]>) {
		this.search = search;
	}

	get isActive(): boolean {
		return this.query.trim() !== '';
	}

	/** Call on every input event (the query is bound to the box) */
	handleInput(): void {
		clearTimeout(this.timer);
		const query = this.query.trim();
		if (!query) {
			this.results = [];
			this.isSearching = false;
			return;
		}
		this.isSearching = true;
		this.timer = setTimeout(() => void this.run(query), SEARCH_DEBOUNCE_MS);
	}

	private async run(query: string): Promise<void> {
		const requestNumber = ++this.requestCounter;
		try {
			const results = await this.search(query);
			if (requestNumber === this.requestCounter) this.results = results;
		} catch (error) {
			console.error('Error searching notes:', error);
			if (requestNumber === this.requestCounter) this.results = [];
		} finally {
			if (requestNumber === this.requestCounter) this.isSearching = false;
		}
	}

	clear(): void {
		this.query = '';
		this.results = [];
		this.isSearching = false;
		clearTimeout(this.timer);
	}

	dispose(): void {
		clearTimeout(this.timer);
	}
}
