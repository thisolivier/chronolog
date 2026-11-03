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
