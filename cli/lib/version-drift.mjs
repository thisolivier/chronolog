/**
 * Version drift notice (044-CL). The server reports the git commit its image was built from
 * (`serverCommit` on `/api/me`, `dev` when run from a checkout); this CLI runs from a checkout and
 * reads its own commit with git. When both are known and differ, one line goes to stderr:
 *   chronolog: server is at <commit>, this CLI at <commit>: run git pull
 * The check runs at most once a day (`version-check.json` next to the config file), never writes to
 * stdout, and never fails a command: any error just skips it. `CHRONOLOG_NO_VERSION_CHECK=1` turns
 * it off.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configPath } from './config.mjs';

export const CHECK_INTERVAL_MILLISECONDS = 24 * 60 * 60 * 1000;
const SHORT_LENGTH = 7;

/** The commit of the checkout this CLI runs from, or null (not a git checkout, git missing). */
export function readCliCommit(cliDirectory = dirname(fileURLToPath(import.meta.url))) {
	try {
		return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: cliDirectory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
	} catch {
		return null;
	}
}

const isRealCommit = (commit) => typeof commit === 'string' && /^[0-9a-f]{7,40}$/i.test(commit.trim());

/** True when both commits are known and differ (a short and a full hash of one commit match). */
export function commitsDiffer(serverCommit, cliCommit) {
	if (!isRealCommit(serverCommit) || !isRealCommit(cliCommit)) return false;
	const server = serverCommit.trim().toLowerCase();
	const cli = cliCommit.trim().toLowerCase();
	const comparedLength = Math.min(server.length, cli.length);
	return server.slice(0, comparedLength) !== cli.slice(0, comparedLength);
}

export function driftMessage(serverCommit, cliCommit) {
	return `chronolog: server is at ${serverCommit.slice(0, SHORT_LENGTH)}, this CLI at ${cliCommit.slice(0, SHORT_LENGTH)}: run git pull`;
}

export function versionCheckPath(environment = process.env) {
	return join(dirname(configPath(environment)), 'version-check.json');
}

function readLastCheck(path) {
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		return null;
	}
}

/** Is a check due? (none yet, unreadable, older than a day, or dated in the future) */
export function checkIsDue(lastCheck, now) {
	const checkedAt = Date.parse(lastCheck?.checkedAt ?? '');
	if (Number.isNaN(checkedAt)) return true;
	const elapsed = now.getTime() - checkedAt;
	return elapsed < 0 || elapsed >= CHECK_INTERVAL_MILLISECONDS;
}

/**
 * Run the daily check: ask `/api/me` (or use `meResult` when the command already fetched it),
 * remember when, and write the notice to `stderr` on drift. Returns the notice or null.
 */
export async function noticeVersionDrift({ api, environment = process.env, stderr = process.stderr, now = new Date(), readCommit = readCliCommit, meResult } = {}) {
	try {
		if (environment.CHRONOLOG_NO_VERSION_CHECK) return null;
		const path = versionCheckPath(environment);
		if (!checkIsDue(readLastCheck(path), now)) return null;
		const serverCommit = (meResult ?? (await api.get('/api/me')))?.serverCommit ?? null;
		const cliCommit = readCommit();
		mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
		writeFileSync(path, JSON.stringify({ checkedAt: now.toISOString(), serverCommit, cliCommit }, null, 2) + '\n', { mode: 0o600 });
		if (!commitsDiffer(serverCommit, cliCommit)) return null;
		const notice = driftMessage(serverCommit, cliCommit);
		stderr.write(notice + '\n');
		return notice;
	} catch {
		return null;
	}
}
