#!/usr/bin/env node
/**
 * chronolog — command-line client for the Chronolog REST API (sprint 028-CL).
 * No dependencies beyond Node 20+. See cli/readme.md and the chronolog-secretary skill.
 *
 * Exit codes: 0 ok · 1 error · 2 usage · 3 unknown or ambiguous reference (ask the person)
 *             4 auth (401/403: token, device key) · 5 conflict (409) · 6 rate limited (429)
 */

import { commandFromPositionals, parseArguments, UsageError } from './lib/args.mjs';
import { loadConfig } from './lib/config.mjs';
import { ApiError, createApiClient } from './lib/api.mjs';
import { ReferenceError_ } from './lib/resolve.mjs';
import * as read from './commands/read.mjs';
import * as write from './commands/write.mjs';
import * as correct from './commands/correct.mjs';
import * as manageClients from './commands/manage-clients.mjs';
import * as manageStructure from './commands/manage-structure.mjs';
import { init } from './commands/init.mjs';
import { Cancelled } from './lib/confirm.mjs';

const USAGE = `Usage: chronolog <command> [arguments] [--json]

  init                                   save server URL, API token, device key
  me                                     who you are, today, current ISO week
  clients [--all]                        list clients (--all: archived too)
  contracts [client] [--all]             list contracts (optionally one client's)
  week [2026-W45] [--client X | --contract X]   entries and totals for a week (default: current)
  log <contract> <duration> "<desc>" [--date D] [--deliverable X [--work-type Y]] [--note ID]
  edit <entry-id> [--duration D] [--description "..."] [--date D] [--deliverable X|none]
  undo                                   delete the last entry this CLI logged
  note new <contract> "<title>" [--file body.md]   body from --file or stdin
  note show <note-id>
  notes <contract> [--since YYYY-MM-DD]
  search "<words or note id>" [--limit N]
  status <2026-W45|current> <unsubmitted|draft-ready|submitted>

Setting up clients (remove asks first; -y/--yes skips the question, required without a terminal):
  client add "<name>" --code SHORT [--emoji X] [--color 0-7]
  client edit|archive|unarchive|remove <client>      edit: [--name] [--code] [--emoji X|none] [--color]
  contract add <client> "<name>" [--description D] [--inactive]
  contract edit|archive|unarchive|remove <contract>  edit: [--name] [--description D|none] [--active|--inactive]
  deliverables <contract> [--all]
  deliverable add <contract> "<name>" [--order N]
  deliverable edit|remove <SHORT/Contract/Deliverable>       edit: [--name] [--order N]
  work-types <SHORT/Contract/Deliverable> [--all]            (alias: tags)
  work-type add <SHORT/Contract/Deliverable> "<name>" [--order N]   (alias: tag)
  work-type edit|remove <SHORT/Contract/Deliverable/WorkType>

References: an id, or SHORTCODE, SHORTCODE/Contract, SHORTCODE/Contract/Deliverable, …/WorkType.
Durations: 1h30m, 1.5, 1:30, 90m, 9:00-10:30.  Dates: YYYY-MM-DD, today, yesterday, monday…
--json prints machine-readable output; errors go to stderr as {"error","code","status"}.`;

const COMMANDS = {
	me: read.me,
	whoami: read.me,
	clients: read.clients,
	contracts: read.contracts,
	week: read.week,
	notes: read.notes,
	search: read.search,
	log: write.log,
	status: write.status,
	edit: correct.edit,
	undo: correct.undo,
	'note new': write.noteNew,
	'note show': read.noteShow,
	'client add': manageClients.clientAdd,
	'client edit': manageClients.clientEdit,
	'client archive': manageClients.clientArchive,
	'client unarchive': manageClients.clientUnarchive,
	'client remove': manageClients.clientRemove,
	'contract add': manageClients.contractAdd,
	'contract edit': manageClients.contractEdit,
	'contract archive': manageClients.contractArchive,
	'contract unarchive': manageClients.contractUnarchive,
	'contract remove': manageClients.contractRemove,
	deliverables: manageStructure.deliverables,
	'deliverable add': manageStructure.deliverableAdd,
	'deliverable edit': manageStructure.deliverableEdit,
	'deliverable remove': manageStructure.deliverableRemove,
	'work-types': manageStructure.workTypes,
	'work-type add': manageStructure.workTypeAdd,
	'work-type edit': manageStructure.workTypeEdit,
	'work-type remove': manageStructure.workTypeRemove
};



function exitCodeFor(failure) {
	if (failure instanceof UsageError) return 2;
	if (failure instanceof ReferenceError_) return 3;
	if (failure instanceof ApiError) {
		if (failure.status === 401 || failure.status === 403) return 4;
		if (failure.status === 404 && failure.code === 'note_not_found') return 3;
		if (failure.status === 409) return 5;
		if (failure.status === 429) return 6;
	}
	return 1;
}

export async function main(argv, environment = process.env) {
	const { positionals, flags } = parseArguments(argv);
	const asJson = Boolean(flags.json);
	const print = (humanText, jsonValue) => {
		process.stdout.write((asJson ? JSON.stringify(jsonValue, null, 2) : humanText) + '\n');
	};

	const { commandName, rest } = commandFromPositionals(positionals);

	try {
		if (!commandName || flags.help || commandName === 'help') {
			process.stdout.write(USAGE + '\n');
			return commandName || flags.help ? 0 : 2;
		}
		if (commandName === 'init') {
			await init({ print, flags });
			return 0;
		}
		const command = COMMANDS[commandName];
		if (!command) throw new UsageError(`Unknown command “${commandName}”. Run chronolog --help.`);
		const config = loadConfig(environment);
		const api = createApiClient(config);
		await command({ api, print, positionals: rest, flags, config, environment });
		return 0;
	} catch (failure) {
		if (failure instanceof Cancelled) {
			print('Nothing removed.', { removed: false });
			return 0;
		}
		const exitCode = exitCodeFor(failure);
		if (asJson) {
			process.stderr.write(JSON.stringify({ error: failure.message, code: failure.code ?? (exitCode === 2 ? 'usage' : 'error'), status: failure.status, candidates: failure.candidates }) + '\n');
		} else {
			process.stderr.write(`chronolog: ${failure.message}\n`);
			if (failure.candidates?.length) process.stderr.write(failure.candidates.map((line) => `  ${line}`).join('\n') + '\n');
			if (exitCode === 4) process.stderr.write('  (check the API token and device key; `chronolog init` to replace them)\n');
		}
		return exitCode;
	}
}

main(process.argv.slice(2)).then((exitCode) => {
	process.exitCode = exitCode;
});
