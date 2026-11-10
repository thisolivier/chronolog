/**
 * The Total time request loop (sprint 065-TT, moved out of TotalTimeModal in 066-TR, unchanged):
 * ask for the total 200 ms after the last change, show only the newest request's reply (stale
 * replies ignored), never keep an old number while a new one is coming. `retry()` asks again with
 * the same filters (TT-12's Try again).
 */
import { untrack } from 'svelte';
import type { TotalTimeRequest, TotalTimeResult } from '$lib/services/types';

export type TotalTimeFailure = 'offline' | 'error';

export class TotalTimeQuery {
	reply = $state<TotalTimeResult | null>(null);
	isLoading = $state(false);
	failure = $state<TotalTimeFailure | null>(null);
	private retryCount = $state(0);
	private requestSequence = 0;

	constructor(
		private readonly fetchTotal: (request: TotalTimeRequest) => Promise<TotalTimeResult>,
		private readonly classifyFailure: (error: unknown) => TotalTimeFailure
	) {}

	/**
	 * Call from an `$effect`: reads the request (and the retry count) so a change asks again;
	 * `null` means nothing to ask (no selection, From after To, contracts not loaded). Returns the
	 * effect's cleanup.
	 */
	follow(readRequest: () => TotalTimeRequest | null): () => void {
		void this.retryCount;
		const request = readRequest();
		const sequence = ++this.requestSequence;
		untrack(() => {
			this.isLoading = request !== null;
			this.failure = null;
			this.reply = null;
		});
		if (!request) return () => {};
		const debounceTimer = setTimeout(async () => {
			try {
				const totalReply = await this.fetchTotal(request);
				if (sequence === this.requestSequence) this.reply = totalReply;
			} catch (error) {
				if (sequence === this.requestSequence) this.failure = this.classifyFailure(error);
			} finally {
				if (sequence === this.requestSequence) this.isLoading = false;
			}
		}, 200);
		return () => clearTimeout(debounceTimer);
	}

	retry() {
		this.retryCount += 1;
	}
}
