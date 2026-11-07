/**
 * The `[[` picker's querying (059-DR, SR-07), shared by the note editor and (to adopt) the time
 * entry description's WikiLinkInput: debounced requests, a stale-response guard (each request gets
 * a number and only the latest one's reply is used; older ones are also aborted), and distinct
 * loading / ready / error states. Typing never waits on it: callers hand over each query and read
 * `status` and `items`. While a new query loads, the previous items stay visible (`status` is
 * `loading`), so the list does not flicker on every key.
 */
import { fetchLinkTargets, type LinkPickerItem, type LinkTargetRequest } from './link-targets';

export type LinkPickerStatus = 'loading' | 'ready' | 'error';

export type LinkPickerSearchOptions = {
	/** Defaults to `fetchLinkTargets` (`GET /api/notes/search`) */
	fetchTargets?: (query: string, request: LinkTargetRequest) => Promise<LinkPickerItem[]>;
	debounceMs?: number;
	limit?: number;
	/** Called after every change of status or items (e.g. to reposition a popup) */
	onChange?: () => void;
};

export const LINK_PICKER_DEBOUNCE_MS = 150;

export function createLinkPickerSearch(options: LinkPickerSearchOptions = {}) {
	const fetchTargets = options.fetchTargets ?? fetchLinkTargets;
	const debounceMs = options.debounceMs ?? LINK_PICKER_DEBOUNCE_MS;
	const state = $state({ query: null as string | null, status: 'loading' as LinkPickerStatus, items: [] as LinkPickerItem[] });
	let exclude: string | null = null;
	let latestRequest = 0;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let controller: AbortController | null = null;
	let disposed = false;

	function cancelPending() {
		if (timer) clearTimeout(timer);
		timer = null;
		controller?.abort();
		controller = null;
	}

	async function run(query: string) {
		const requestNumber = ++latestRequest;
		controller = new AbortController();
		const signal = controller.signal;
		try {
			const items = await fetchTargets(query, { exclude, limit: options.limit, signal });
			if (disposed || requestNumber !== latestRequest) return;
			state.items = items;
			state.status = 'ready';
		} catch {
			if (disposed || requestNumber !== latestRequest || signal.aborted) return;
			state.items = [];
			state.status = 'error';
		}
		options.onChange?.();
	}

	/**
	 * The query typed after `[[` (empty: recent notes). The first query, and `immediate`, ask at
	 * once; later ones wait for a pause in typing.
	 */
	function setQuery(query: string, settings: { exclude?: string | null; immediate?: boolean } = {}) {
		if (disposed) return;
		if (settings.exclude !== undefined) exclude = settings.exclude;
		if (query === state.query && state.status !== 'error') return;
		const isFirst = state.query === null;
		state.query = query;
		state.status = 'loading';
		cancelPending();
		// Any reply still on its way is now out of date
		latestRequest++;
		options.onChange?.();
		if (isFirst || settings.immediate || debounceMs <= 0) void run(query);
		else timer = setTimeout(() => void run(query), debounceMs);
	}

	function retry() {
		if (state.query === null) return;
		const query = state.query;
		state.query = null;
		setQuery(query, { immediate: true });
	}

	function dispose() {
		disposed = true;
		cancelPending();
	}

	return {
		get query() {
			return state.query ?? '';
		},
		get status() {
			return state.status;
		},
		get items() {
			return state.items;
		},
		setQuery,
		retry,
		dispose
	};
}

export type LinkPickerSearch = ReturnType<typeof createLinkPickerSearch>;
