import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			devOptions: {
				enabled: false
			},
			manifest: {
				name: 'Chronolog',
				short_name: 'Chronolog',
				description: 'Time tracking and note-taking for consulting',
				theme_color: '#1e293b',
				background_color: '#0f172a',
				display: 'standalone',
				scope: '/',
				start_url: '/',
				icons: []
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
				// Navigation fallback for SPA-like routing
				navigateFallback: '/',
				runtimeCaching: [
					{
						// Sync push endpoint: NetworkOnly with Background Sync retry
						urlPattern: /^\/api\/sync\/push$/,
						handler: 'NetworkOnly',
						options: {
							backgroundSync: {
								name: 'sync-push-queue',
								options: {
									maxRetentionTime: 24 * 60 // 24 hours in minutes
								}
							}
						}
					},
					{
						// Sync routes: NetworkOnly (sync must always hit the server)
						urlPattern: /^\/api\/sync\//,
						handler: 'NetworkOnly'
					},
					{
						// Auth routes: NetworkOnly (auth must always hit server)
						urlPattern: /^\/api\/auth\//,
						handler: 'NetworkOnly'
					},
					{
						// Other API requests: NetworkFirst (try server, fall back to cache)
						urlPattern: /^\/api\//,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache',
							expiration: {
								maxEntries: 100,
								maxAgeSeconds: 60 * 60 * 24 // 24 hours
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					}
				]
			}
		})
	],
	test: {
		include: ['src/**/*.test.ts']
	}
});
