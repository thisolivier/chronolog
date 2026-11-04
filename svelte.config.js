import adapterNode from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapterNode(),
		// Registered by the root layout outside the Tauri desktop app (sprint 045-CL review fix 6)
		serviceWorker: { register: false }
	}
};

export default config;
