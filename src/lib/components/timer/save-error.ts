/**
 * Turn a failed save into a short message for the form ("Couldn't save: …").
 * Fetch helpers throw `POST /api/x failed (400): {"message":"…"}`; only the server's
 * own message is kept.
 */
export function describeSaveError(error: unknown): string {
	const detail = error instanceof Error ? error.message.trim() : '';
	if (!detail || /failed to fetch|networkerror|load failed/i.test(detail)) {
		return "Couldn't save: no connection to the server. Check your connection and retry.";
	}
	const httpFailure = detail.match(/failed \((\d{3})\):\s*([\s\S]*)$/);
	if (httpFailure) {
		return `Couldn't save: ${extractServerMessage(httpFailure[2]) || `server error ${httpFailure[1]}`}`;
	}
	return `Couldn't save: ${detail}`;
}

function extractServerMessage(body: string): string {
	try {
		const parsedBody = JSON.parse(body) as { message?: unknown; error?: unknown };
		if (typeof parsedBody.message === 'string') return parsedBody.message;
		return typeof parsedBody.error === 'string' ? parsedBody.error : '';
	} catch {
		return body.length <= 120 ? body.trim() : '';
	}
}

/** A stale capture refused by the server (sprint 056-DR guards on timer save / discard) */
export type TimerConflictCode = 'not_a_draft' | 'timer_changed' | 'expected_start_required';

const TIMER_CONFLICT_CODES: TimerConflictCode[] = ['not_a_draft', 'timer_changed', 'expected_start_required'];

/** The 409 code when the server refused a stale timer save or discard; null for any other failure */
export function timerConflictFrom(error: unknown): TimerConflictCode | null {
	const detail = error instanceof Error ? error.message : '';
	const conflict = detail.match(/failed \(409\):\s*([\s\S]*)$/);
	if (!conflict) return null;
	try {
		const code = (JSON.parse(conflict[1]) as { code?: unknown }).code;
		return TIMER_CONFLICT_CODES.find((known) => known === code) ?? null;
	} catch {
		return null;
	}
}

/** What the widget says after reloading the timer from the server, for each conflict */
export function describeTimerConflict(code: TimerConflictCode, action: 'save' | 'discard'): string {
	if (code === 'not_a_draft') {
		return 'This entry was already saved or discarded, probably on another device. The timer has been reloaded.';
	}
	const verb = action === 'save' ? 'saved' : 'discarded';
	return `This timer changed on another device (its times moved or it was split), so it was not ${verb}. The latest times are shown: check them and ${action} again.`;
}
