import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'prompt',
			manifest: {
				name: 'Chronolog',
				short_name: 'Chronolog',
				description: 'Time tracking and notes for consulting',
				theme_color: '#2563eb',
				background_color: '#ffffff',
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
			workbox: {
				// Precache app shell assets (HTML, CSS, JS, fonts)
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
				// Runtime caching for API calls and dynamic content
				runtimeCaching: [
					{
						// API data routes — try network first, fall back to cache
						urlPattern: /^\/api\/.*/i,
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
					},
					{
						// Static assets from CDN or same-origin — cache first
						urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot)$/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'static-assets-cache',
							expiration: {
								maxEntries: 100,
								maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					}
				],
				// Navigation fallback for offline SPA routing
				navigateFallback: '/',
				navigateFallbackAllowlist: [/^(?!\/(api|_app))/]
			}
		})
	],
	server: {
		allowedHosts: ['app'],
		watch: {
			// Other sessions' worktrees live under .claude/worktrees; their `svelte-kit sync`
			// rewrites tsconfig files there, which would force full reloads of this dev server.
			ignored: ['**/.claude/**']
		}
	},
	test: {
		include: ['src/**/*.test.ts'],
		exclude: ['src/e2e/**', 'node_modules/**']
	}
});
