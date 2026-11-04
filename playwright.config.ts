import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
/** Point at another dev server (e.g. a worktree on its own port) with PLAYWRIGHT_BASE_URL */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
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
		baseURL: BASE_URL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		// The app's service worker (sprint 045-CL) is off by default: Playwright's request routing
		// does not see requests a worker answers, and in WebKit the two together fail requests.
		// offline-outbox.spec.ts turns it on where it is under test.
		serviceWorkers: 'block'
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
		url: BASE_URL,
		reuseExistingServer: true,
		// auth.setup.ts registers a fresh user per run, so sign-up must be open.
		// Note: with reuseExistingServer, an already-running server keeps its own
		// environment — start it with ALLOW_REGISTRATION=true yourself in that case.
		env: {
			ALLOW_REGISTRATION: 'true'
		}
	}
});
