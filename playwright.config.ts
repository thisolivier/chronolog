import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const AUTH_STATE_PATH = path.join(currentDirectory, 'e2e-playwright', '.auth', 'user.json');

export default defineConfig({
	testDir: './e2e-playwright',
	timeout: 30000,
	expect: {
		timeout: 10000
	},
	fullyParallel: true,
	retries: 1,
	reporter: [['html', { open: 'never' }], ['list']],
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},
	projects: [
		// --- Auth setup (runs first, no browser filter) ---
		{
			name: 'auth-setup',
			testMatch: /auth\.setup\.ts/,
			use: { browserName: 'chromium' }
		},

		// --- Chromium tests (depend on auth-setup) ---
		{
			name: 'chromium',
			use: {
				browserName: 'chromium',
				storageState: AUTH_STATE_PATH
			},
			dependencies: ['auth-setup'],
			testIgnore: /auth\.setup\.ts/
		},

		// --- WebKit tests (depend on auth-setup) ---
		{
			name: 'webkit',
			use: {
				browserName: 'webkit',
				storageState: AUTH_STATE_PATH
			},
			dependencies: ['auth-setup'],
			testIgnore: /auth\.setup\.ts/
		}
	],
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: true
	}
});
