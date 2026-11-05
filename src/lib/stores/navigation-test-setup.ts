/**
 * Shared setup for the navigation store tests: a fake adapter records the URLs the store writes,
 * `settle()` plays the afterNavigate that SvelteKit fires once a navigation lands, and `enter()`
 * plays the first load (sprint 027-CL; moved here in 050-UI for navigation-steps.test.ts).
 */
import { createNavigationState, type NavigationContext } from './navigation.svelte';

// Wednesday 4 November 2026 -> ISO week 45, Monday 2 November
const NOW = () => new Date(2026, 10, 4, 10, 0, 0);

type Call = { path: string; replace: boolean };

export class MemoryStorage {
	private values = new Map<string, string>();
	get length() {
		return this.values.size;
	}
	clear() {
		this.values.clear();
	}
	getItem(key: string) {
		return this.values.get(key) ?? null;
	}
	key(index: number) {
		return [...this.values.keys()][index] ?? null;
	}
	removeItem(key: string) {
		this.values.delete(key);
	}
	setItem(key: string, value: string) {
		this.values.set(key, value);
	}
}

export function setup(startPath = '/', storage = new MemoryStorage()) {
	const calls: Call[] = [];
	let backCalls = 0;
	let forwardCalls = 0;
	const nav = createNavigationState({
		initialUrl: new URL('http://app' + startPath),
		adapter: {
			navigate: (path, { replace }) => {
				calls.push({ path, replace });
			},
			back: () => {
				backCalls++;
			},
			forward: () => {
				forwardCalls++;
			}
		},
		sessionStorage: storage as unknown as Storage,
		localStorage: storage as unknown as Storage,
		now: NOW
	});
	/** Let the store flush (one microtask) and then report the navigation landing */
	async function settle() {
		await Promise.resolve();
		const last = calls.at(-1);
		if (last) await nav.syncFromUrl(new URL('http://app' + last.path), 'goto');
	}
	return { nav, calls, settle, backCount: () => backCalls, forwardCount: () => forwardCalls, storage };
}

export async function enter(nav: NavigationContext, path: string, loadType = 'reload') {
	await nav.syncFromUrl(new URL('http://app' + path), 'enter', undefined, loadType);
}

