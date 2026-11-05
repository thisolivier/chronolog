/**
 * Copy text to the clipboard (sprint 051-UI, the note code in the editor header).
 * The async Clipboard API first (Chromium, Safari/WebKit and the Tauri webview allow it from a
 * click); if it is missing or refused, the old hidden-textarea `execCommand('copy')`. Resolves to
 * whether the text was copied, never throws.
 */
export interface CopyEnvironment {
	clipboard?: { writeText(text: string): Promise<void> } | null;
	document?: Document | null;
}

export async function copyText(text: string, environment: CopyEnvironment = defaultEnvironment()): Promise<boolean> {
	if (environment.clipboard) {
		try {
			await environment.clipboard.writeText(text);
			return true;
		} catch {
			// Refused (permissions, not a user gesture): try the fallback
		}
	}
	return copyWithTextarea(text, environment.document ?? null);
}

function copyWithTextarea(text: string, ownerDocument: Document | null): boolean {
	if (!ownerDocument?.body) return false;
	const textarea = ownerDocument.createElement('textarea');
	textarea.value = text;
	textarea.setAttribute('readonly', '');
	textarea.style.position = 'fixed';
	textarea.style.opacity = '0';
	ownerDocument.body.appendChild(textarea);
	try {
		textarea.select();
		return ownerDocument.execCommand?.('copy') === true;
	} catch {
		return false;
	} finally {
		textarea.remove();
	}
}

function defaultEnvironment(): CopyEnvironment {
	return {
		clipboard: typeof navigator !== 'undefined' ? (navigator.clipboard ?? null) : null,
		document: typeof document !== 'undefined' ? document : null
	};
}
