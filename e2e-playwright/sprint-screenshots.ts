/**
 * Where a spec writes its sprint's review screenshots (044-CL). By default they go under
 * `test-results/sprint-screenshots/<sprint>/`, so a full Playwright run no longer rewrites every
 * sprint's committed images in `docs/review/screenshots/`. Set `UPDATE_SPRINT_SCREENSHOTS=1` to
 * write them into `docs/review/screenshots/<sprint>/` (do it for your own sprint's spec only):
 *   UPDATE_SPRINT_SCREENSHOTS=1 npx playwright test e2e-playwright/two-factor-login.spec.ts --project=chromium
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function sprintScreenshotDirectory(sprintFolder: string): string {
	return process.env.UPDATE_SPRINT_SCREENSHOTS === '1'
		? path.join(REPOSITORY_ROOT, 'docs', 'review', 'screenshots', sprintFolder)
		: path.join(REPOSITORY_ROOT, 'test-results', 'sprint-screenshots', sprintFolder);
}
