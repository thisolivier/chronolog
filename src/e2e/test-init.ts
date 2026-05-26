/**
 * E2E Test Init
 *
 * Import this at the top of every e2e test file to restore
 * session cookies from the globalSetup.
 */

import { beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setSessionCookies } from './helpers';

const SESSION_FILE = join(import.meta.dirname, '.e2e-session.json');

beforeAll(() => {
	let sessionJson: string;
	try {
		sessionJson = readFileSync(SESSION_FILE, 'utf-8');
	} catch {
		throw new Error(
			`E2E session file not found at ${SESSION_FILE}. ` +
			'Is globalSetup running? Check that vitest.config.e2e.ts is being used.'
		);
	}

	const sessionData = JSON.parse(sessionJson) as { cookies: string[] };
	setSessionCookies(sessionData.cookies);
});
