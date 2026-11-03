/**
 * CLI configuration: `~/.config/chronolog/config.json` (`$XDG_CONFIG_HOME` respected,
 * `$CHRONOLOG_CONFIG` overrides the path) with `baseUrl`, `apiToken`, `deviceKey`.
 * Environment variables win over the file: CHRONOLOG_BASE_URL, CHRONOLOG_API_TOKEN,
 * CHRONOLOG_DEVICE_KEY. The file is written with mode 0600 and never printed.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const DEFAULT_BASE_URL = 'https://chronolog.throb.online';

export function configPath(environment = process.env) {
	if (environment.CHRONOLOG_CONFIG) return environment.CHRONOLOG_CONFIG;
	const configHome = environment.XDG_CONFIG_HOME || join(homedir(), '.config');
	return join(configHome, 'chronolog', 'config.json');
}

export function readConfigFile(path = configPath()) {
	if (!existsSync(path)) return {};
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		throw new Error(`Cannot read ${path}: not valid JSON. Run \`chronolog init\` again.`);
	}
}

export function loadConfig(environment = process.env) {
	const fileConfig = readConfigFile(configPath(environment));
	return {
		baseUrl: (environment.CHRONOLOG_BASE_URL || fileConfig.baseUrl || '').replace(/\/+$/, ''),
		apiToken: environment.CHRONOLOG_API_TOKEN || fileConfig.apiToken || '',
		deviceKey: environment.CHRONOLOG_DEVICE_KEY || fileConfig.deviceKey || ''
	};
}

export function writeConfigFile(config, path = configPath()) {
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	writeFileSync(path, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
	chmodSync(path, 0o600);
	return path;
}
