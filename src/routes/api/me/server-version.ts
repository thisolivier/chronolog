/** The server's version, from the repo's `package.json` (bundled at build time). */
import packageJson from '../../../../package.json';

export const SERVER_VERSION: string = packageJson.version;
