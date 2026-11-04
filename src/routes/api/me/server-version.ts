/**
 * The server's version, from the repo's `package.json` (bundled at build time), and its build
 * commit: `CHRONOLOG_BUILD_COMMIT`, which the production image bakes in from the `BUILD_COMMIT`
 * build argument (`scripts/deploy-prod.sh` passes `git rev-parse HEAD`). `dev` when unset, as in
 * `npm run dev`; the CLI never reports drift against `dev`.
 */
import { env } from '$env/dynamic/private';
import packageJson from '../../../../package.json';

export const SERVER_VERSION: string = packageJson.version;

export function serverBuildCommit(): string {
	return env.CHRONOLOG_BUILD_COMMIT?.trim() || 'dev';
}
