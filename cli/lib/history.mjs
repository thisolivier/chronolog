/**
 * The last time entry this CLI created, so `chronolog undo` can delete exactly that one.
 * Stored next to the config file as `last-entry.json` (mode 600): `{ entryId, baseUrl,
 * createdAt, summary }`. Only `log` writes it; `undo` clears it after deleting.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { configPath } from './config.mjs';

export function lastEntryPath(environment = process.env) {
	return join(dirname(configPath(environment)), 'last-entry.json');
}

export function readLastEntry(environment = process.env) {
	const path = lastEntryPath(environment);
	if (!existsSync(path)) return null;
	try {
		const record = JSON.parse(readFileSync(path, 'utf8'));
		return typeof record?.entryId === 'string' ? record : null;
	} catch {
		return null;
	}
}

export function recordLastEntry(record, environment = process.env) {
	const path = lastEntryPath(environment);
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	writeFileSync(path, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
}

export function clearLastEntry(environment = process.env) {
	rmSync(lastEntryPath(environment), { force: true });
}
