/**
 * Which `chronolog://attachment/<id>` links point at a deleted attachment (sprint 043-CL).
 *
 * `checkAttachment` asks the server once per attachment (`HEAD /api/attachments/<id>`, never from
 * the HTTP cache) and remembers the answer; `note-attachments-changed` (an upload or delete in the
 * attachment list) forgets the answers so links follow. The `AttachmentLinkStatus` extension marks
 * links to a missing attachment with an inline decoration (`attachment-link-missing`, styled like a
 * missing image), so the document is never changed; `openAttachment` refuses a known-missing one
 * instead of opening a tab that closes again.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { parseChronologUrl } from './attachment-resolver.js';

type AttachmentStatus = 'present' | 'missing';

const statuses = new Map<string, AttachmentStatus>();
const pendingChecks = new Map<string, Promise<boolean>>();
const listeners = new Set<() => void>();

/** Known status of the attachment behind a chronolog URL; undefined until checked. */
export function attachmentStatus(chronologUrl: string): AttachmentStatus | undefined {
	const attachmentId = parseChronologUrl(chronologUrl);
	return attachmentId ? statuses.get(attachmentId) : 'missing';
}

/** Resolve true when the attachment exists (asks the server once, then remembers). */
export function checkAttachment(chronologUrl: string, fetcher: typeof fetch = fetch): Promise<boolean> {
	const attachmentId = parseChronologUrl(chronologUrl);
	if (!attachmentId) return Promise.resolve(false);
	const known = statuses.get(attachmentId);
	if (known) return Promise.resolve(known === 'present');
	const pending = pendingChecks.get(attachmentId);
	if (pending) return pending;
	const check = fetcher(`/api/attachments/${attachmentId}`, { method: 'HEAD', cache: 'no-store' })
		.then((response) => {
			// Only a definite "not found" counts as missing; offline or a server error leaves it unknown
			if (response.ok) setStatus(attachmentId, 'present');
			else if (response.status === 404) setStatus(attachmentId, 'missing');
			return response.ok;
		})
		.catch(() => true)
		.finally(() => pendingChecks.delete(attachmentId));
	pendingChecks.set(attachmentId, check);
	return check;
}

/** Record that an attachment is gone (a failed open) or back. */
export function markAttachmentStatus(chronologUrl: string, status: AttachmentStatus): void {
	const attachmentId = parseChronologUrl(chronologUrl);
	if (attachmentId) setStatus(attachmentId, status);
}

/** Forget every answer (attachments were added or deleted); open editors check again. */
export function forgetAttachmentStatuses(): void {
	statuses.clear();
	notify();
}

export function subscribeToAttachmentStatuses(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function setStatus(attachmentId: string, status: AttachmentStatus) {
	if (statuses.get(attachmentId) === status) return;
	statuses.set(attachmentId, status);
	notify();
}

function notify() {
	for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
	window.addEventListener('note-attachments-changed', forgetAttachmentStatuses);
}

const attachmentLinkStatusKey = new PluginKey<DecorationSet>('attachmentLinkStatus');

/** Decorations for links to missing attachments; starts checks for links not yet known. */
function buildDecorations(state: EditorState): DecorationSet {
	const decorations: Decoration[] = [];
	state.doc.descendants((node, position) => {
		if (!node.isText) return;
		const linkMark = node.marks.find((mark) => mark.type.name === 'link');
		const href = (linkMark?.attrs.href as string | undefined) ?? '';
		if (!href.startsWith('chronolog://')) return;
		const status = attachmentStatus(href);
		if (status === undefined) void checkAttachment(href);
		if (status === 'missing') {
			decorations.push(
				Decoration.inline(position, position + node.nodeSize, {
					class: 'attachment-link-missing',
					title: 'This file was deleted',
					'data-attachment-missing': 'true'
				})
			);
		}
	});
	return DecorationSet.create(state.doc, decorations);
}

/** Marks links to deleted attachments; only plugin meta is dispatched, so nothing autosaves. */
export const AttachmentLinkStatus = Extension.create({
	name: 'attachmentLinkStatus',
	addProseMirrorPlugins() {
		return [
			new Plugin<DecorationSet>({
				key: attachmentLinkStatusKey,
				state: {
					init: (_config, state) => buildDecorations(state),
					apply: (transaction, previous, _oldState, newState) =>
						transaction.docChanged || transaction.getMeta(attachmentLinkStatusKey)
							? buildDecorations(newState)
							: previous
				},
				props: {
					decorations: (state) => attachmentLinkStatusKey.getState(state)
				},
				view: (editorView) => {
					const unsubscribe = subscribeToAttachmentStatuses(() => {
						// A status arrived: redraw (deferred: a check can settle during a dispatch)
						queueMicrotask(() => {
							if (editorView.isDestroyed) return;
							editorView.dispatch(editorView.state.tr.setMeta(attachmentLinkStatusKey, true));
						});
					});
					return { destroy: unsubscribe };
				}
			})
		];
	}
});
