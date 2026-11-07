/**
 * `chronolog init`: asks for the server URL, API token and device key, writes the config file
 * (mode 0600) and checks the result with GET /api/me. Secrets are read without echo on a
 * terminal; when stdin is piped, the three answers are read line by line instead.
 */

import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { DEFAULT_BASE_URL, configPath, readConfigFile, writeConfigFile } from '../lib/config.mjs';
import { createApiClient } from '../lib/api.mjs';

function askOnTerminal(question, { secret = false } = {}) {
	return new Promise((resolve) => {
		const prompt = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
		if (secret) {
			prompt._writeToOutput = (text) => {
				if (text.includes(question)) process.stdout.write(text);
			};
		}
		prompt.question(question, (answer) => {
			prompt.close();
			if (secret) process.stdout.write('\n');
			resolve(answer.trim());
		});
	});
}

export async function init({ print, flags }) {
	const path = flags.config ?? configPath();
	const existing = readConfigFile(path);
	const defaultUrl = existing.baseUrl || DEFAULT_BASE_URL;

	let answers;
	if (process.stdin.isTTY) {
		answers = [
			await askOnTerminal(`Server URL [${defaultUrl}]: `),
			await askOnTerminal(`API token${existing.apiToken ? ' [keep current]' : ''} (Settings → API tokens): `, { secret: true }),
			await askOnTerminal(`Device access key${existing.deviceKey ? ' [keep current]' : ''} (blank if the server has none): `, { secret: true })
		];
	} else {
		answers = readFileSync(0, 'utf8').split('\n').map((line) => line.trim());
	}

	const config = {
		baseUrl: (answers[0] || defaultUrl).replace(/\/+$/, ''),
		apiToken: answers[1] || existing.apiToken || '',
		deviceKey: answers[2] || existing.deviceKey || ''
	};
	if (!config.apiToken) throw new Error('An API token is required. Create one in Settings → API tokens.');

	writeConfigFile(config, path);
	const result = await createApiClient(config).get('/api/me');
	print(
		`Saved ${path} (mode 600). Connected to ${config.baseUrl} as ${result.user.email}; today is ${result.today}, week ${result.week ?? result.isoWeek}.`,
		{ configPath: path, baseUrl: config.baseUrl, user: result.user, today: result.today, week: result.week ?? result.isoWeek }
	);
}
