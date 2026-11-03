/**
 * Minimal argv parser: positionals plus `--flag value`, `--flag=value` and boolean flags.
 * Only flags listed in `booleanFlags` are value-less; every other `--name` takes the next word.
 */

export class UsageError extends Error {}

export function parseArguments(argv, booleanFlags = ['json', 'help']) {
	const positionals = [];
	const flags = {};
	for (let index = 0; index < argv.length; index += 1) {
		const word = argv[index];
		if (word === '--') {
			positionals.push(...argv.slice(index + 1));
			break;
		}
		if (word.startsWith('--')) {
			const [rawName, inlineValue] = word.slice(2).split(/=(.*)/s, 2);
			const name = rawName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
			if (booleanFlags.includes(name)) {
				flags[name] = inlineValue === undefined ? true : inlineValue !== 'false';
			} else if (inlineValue !== undefined) {
				flags[name] = inlineValue;
			} else {
				const value = argv[index + 1];
				if (value === undefined || value.startsWith('--')) throw new UsageError(`--${rawName} needs a value`);
				flags[name] = value;
				index += 1;
			}
		} else if (word === '-h') {
			flags.help = true;
		} else {
			positionals.push(word);
		}
	}
	return { positionals, flags };
}
