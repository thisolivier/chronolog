import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
/** Point at another dev server (e.g. a worktree on its own port) with PLAYWRIGHT_BASE_URL */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const AUTH_STATE_PATH = path.join(currentDirectory, 'e2e-playwright', '.auth', 'user.json');

/**
 * iPhone projects (sprint 047-QA): WebKit with Playwright's device descriptors (viewport, touch,
 * mobile user agent, device scale). By default they run only the tests tagged `@iphone`; set
 * PLAYWRIGHT_IPHONE_ALL=1 to run the whole suite on them.
 */
const IPHONE_DEVICES = [
	{ name: 'iphone-se', device: 'iPhone SE (3rd gen)' }, // 375×667, the small screen
	{ name: 'iphone-15', device: 'iPhone 15' }, // 393×659 in Safari (852 tall screen)
	{ name: 'iphone-15-pro-max', device: 'iPhone 15 Pro Max' } // 430×739 in Safari (932 tall screen)
] as const;
const IPHONE_TEST_FILTER = process.env.PLAYWRIGHT_IPHONE_ALL === '1' ? undefined : /@iphone/;

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
		},

		// --- iPhone (WebKit, mobile emulation; the @iphone subset unless PLAYWRIGHT_IPHONE_ALL=1) ---
		...IPHONE_DEVICES.map(({ name, device }) => ({
			name,
			use: {
				...devices[device],
				storageState: AUTH_STATE_PATH
			},
			grep: IPHONE_TEST_FILTER,
			dependencies: ['auth-setup'],
			testIgnore: /auth\.setup\.ts/
		}))
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
