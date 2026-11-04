/**
 * Confirmation for `remove` commands (sprint 031-CL). `--yes` skips the question; on a terminal
 * the person types y; with no terminal (Claude, scripts) and no `--yes` the command refuses with
 * a usage error (exit 2), so nothing is ever deleted without an explicit yes.
 */

import { createInterface } from 'node:readline';
import { UsageError } from './args.mjs';

export class Cancelled extends Error {
	constructor() {
		super('Nothing removed.');
		this.code = 'cancelled';
	}
}

function ask(question, stdin, stdout) {
	return new Promise((resolve) => {
		const prompt = createInterface({ input: stdin, output: stdout, terminal: true });
		prompt.question(question, (answer) => {
			prompt.close();
			resolve(answer.trim().toLowerCase());
		});
	});
}

export async function confirmRemoval({ flags, summary, stdin = process.stdin, stdout = process.stderr }) {
	if (flags.yes) return;
	if (!stdin.isTTY) {
		throw new UsageError(`${summary}\nNot removed: confirm with the owner, then run again with --yes (or archive instead).`);
	}
	const answer = await ask(`${summary}\nRemove it? [y/N] `, stdin, stdout);
	if (answer !== 'y' && answer !== 'yes') throw new Cancelled();
}
