/**
 * Minimal argv parser: positionals plus `--flag value`, `--flag=value` and boolean flags.
 * Only flags listed in `booleanFlags` are value-less; every other `--name` takes the next word.
 * `-y` is short for `--yes`. A repeated value flag keeps its last value in `flags`; every value,
 * in order, is in `flagValues` (`--contract A --contract B`, sprint 065-TT).
 */

export class UsageError extends Error {}

export const BOOLEAN_FLAGS = ['json', 'help', 'yes', 'all', 'active', 'inactive', 'version', 'force', 'noInsert', 'dryRun', 'atomic', 'lastImport', 'allContracts', 'allTime'];

export function parseArguments(argv, booleanFlags = BOOLEAN_FLAGS) {
	const positionals = [];
	const flags = {};
	const flagValues = {};
	const setValue = (name, value) => {
		flags[name] = value;
		(flagValues[name] ??= []).push(value);
	};
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
				setValue(name, inlineValue);
			} else {
				const value = argv[index + 1];
				if (value === undefined || value.startsWith('--')) throw new UsageError(`--${rawName} needs a value`);
				setValue(name, value);
				index += 1;
			}
		} else if (word === '-h') {
			flags.help = true;
		} else if (word === '-y') {
			flags.yes = true;
		} else {
			positionals.push(word);
		}
	}
	return { positionals, flags, flagValues };
}

/** Commands written as two words (`note new`, `client add`, `attachment get`); `tag`/`tags` are the owner's word for work types. */
const COMMAND_GROUPS = new Set(['note', 'client', 'contract', 'deliverable', 'work-type', 'attachment', 'timer']);
const ALIASES = { tag: 'work-type', tags: 'work-types', 'work-type-list': 'work-types', worktype: 'work-type', worktypes: 'work-types' };

export function commandFromPositionals(positionals) {
	let [commandName, ...rest] = positionals;
	commandName = ALIASES[commandName] ?? commandName;
	if (COMMAND_GROUPS.has(commandName)) {
		commandName = `${commandName} ${rest[0] ?? ''}`.trim();
		rest = rest.slice(1);
	}
	return { commandName, rest };
}
