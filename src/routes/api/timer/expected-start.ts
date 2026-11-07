/** The optional `expectedStartedAt` of the timer routes (sprint 056-DR): the draft start the client shows. */
import { apiError } from '$lib/server/api-errors';
import { parseExpectedMoment } from './timer-moments';
import type { LocalMoment } from './timer-start-rules';

/** Undefined when absent, the moment as sent (minute or second precision) when valid, else a 400 response. */
export function readExpectedStart(value: unknown): LocalMoment | undefined | Response {
	if (value === undefined || value === null) return undefined;
	return parseExpectedMoment(value) ?? apiError(400, 'expectedStartedAt must be YYYY-MM-DDTHH:MM[:SS]', 'invalid_expected_start');
}
