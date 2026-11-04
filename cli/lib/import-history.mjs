/**
 * The time entries the last `chronolog import entries` created (sprint 038-CL), so
 * `chronolog undo --last-import` can delete them all. Stored next to the config file as
 * `last-import.json` (mode 600): `{ entryIds, baseUrl, createdAt, file }`. Separate from
 * `last-entry.json` (`log` / `undo`), so an import never replaces the undo of a single entry.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { configPath } from './config.mjs';

export function lastImportPath(environment = process.env) {
	return join(dirname(configPath(environment)), 'last-import.json');
}

export function readLastImport(environment = process.env) {
	const path = lastImportPath(environment);
	if (!existsSync(path)) return null;
	try {
		const record = JSON.parse(readFileSync(path, 'utf8'));
		return Array.isArray(record?.entryIds) ? record : null;
	} catch {
		return null;
	}
}

export function recordLastImport(record, environment = process.env) {
	const path = lastImportPath(environment);
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	writeFileSync(path, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
}

export function clearLastImport(environment = process.env) {
	rmSync(lastImportPath(environment), { force: true });
}
