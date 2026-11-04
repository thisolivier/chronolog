/**
 * The CLI's version: the repo's `package.json` (the CLI ships in the repo, versioned with the API
 * it talks to). Read relative to this file, so a `~/.local/bin/chronolog` symlink still finds it.
 * Changes per version are in cli/CHANGELOG.md.
 */

import { readFileSync } from 'node:fs';

export const CLI_VERSION = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
