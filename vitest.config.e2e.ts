import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/e2e/**/*.e2e.test.ts'],
		globalSetup: ['src/e2e/setup.ts'],
		testTimeout: 30_000,
		hookTimeout: 30_000,
		// Run test files sequentially — they share a single test user and database state,
		// and the note ID generation is sequential per day so concurrent creates would collide.
		fileParallelism: false,
		// Allow test files to share state via env vars set in globalSetup
		env: {
			E2E_BASE_URL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173'
		}
	}
});
