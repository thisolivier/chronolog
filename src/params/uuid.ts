import type { ParamMatcher } from '@sveltejs/kit';
import { isUuid } from '$lib/utils/uuid';

/** `[clientId=uuid]`: a malformed ID never reaches the database; SvelteKit answers 404. */
export const match: ParamMatcher = (param) => isUuid(param);
