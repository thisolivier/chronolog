import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'service-worker.ts',
			injectRegister: false,
			manifest: {
				name: 'Chronolog',
				short_name: 'Chronolog',
				description: 'Time tracking and notes for consulting',
				theme_color: '#294c3b',
				background_color: '#f8f6f0',
				display: 'standalone',
				start_url: '/',
				icons: [
					{
						src: '/pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: '/pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			// SvelteKit builds and registers `src/service-worker.ts` (sprint 045-CL: offline reloads).
			// The plugin keeps generating the manifest only; it no longer writes or registers a worker.
			injectManifest: { injectionPoint: undefined }
		})
	],
	server: {
		allowedHosts: ['app'],
		watch: {
			// Other sessions' worktrees live under <root>/.claude/worktrees; their `svelte-kit sync`
			// rewrites tsconfig files there, which would force full reloads of this dev server.
			// Anchored to this project's root: a bare '**/.claude/**' would also match a worktree's
			// own files (they sit under .claude/worktrees/) and stop it from seeing its own edits.
			// Playwright's specs, report and results are not app code; a change there must not reload
			// the pages under test (WebKit runs saw "navigation interrupted" from it).
			ignored: [
				`${resolve(import.meta.dirname, '.claude')}/**`,
				`${resolve(import.meta.dirname, 'e2e-playwright')}/**`,
				`${resolve(import.meta.dirname, 'playwright-report')}/**`,
				`${resolve(import.meta.dirname, 'test-results')}/**`
			]
		}
	},
	test: {
		include: ['src/**/*.test.ts', 'cli/**/*.test.mjs', 'scripts/**/*.test.ts'],
		exclude: ['src/e2e/**', 'node_modules/**']
	}
});
