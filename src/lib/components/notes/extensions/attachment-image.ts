import Image from '@tiptap/extension-image';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { parseChronologUrl, resolveAttachmentUrl } from './attachment-resolver.js';

/**
 * Image node whose `src` stays `chronolog://attachment/{id}` in the document (and so in
 * saved markdown), while the rendered `<img>` shows a blob URL fetched from
 * `/api/attachments/{id}`. Doing this in a node view, rather than rewriting `src` in the
 * editor DOM after the fact, means ProseMirror never sees (or saves) the blob URL and the
 * browser never requests the unknown `chronolog:` scheme.
 */
export const AttachmentImage = Image.extend({
	addNodeView() {
		return ({ node }) => {
			const imageElement = document.createElement('img');
			let currentNode: ProseMirrorNode = node;
			let resolvedFor: string | null = null;

			const render = () => {
				const { src, alt, title } = currentNode.attrs as {
					src: string | null;
					alt: string | null;
					title: string | null;
				};
				if (alt) imageElement.alt = alt;
				else imageElement.removeAttribute('alt');
				if (title) imageElement.title = title;
				else imageElement.removeAttribute('title');

				if (!src || src === resolvedFor) return;
				resolvedFor = src;

				if (!src.startsWith('chronolog://')) {
					imageElement.src = src;
					return;
				}

				imageElement.setAttribute('data-chronolog-src', src);
				imageElement.removeAttribute('src');
				if (!parseChronologUrl(src)) {
					imageElement.classList.add('attachment-missing');
					return;
				}
				void resolveAttachmentUrl(src).then((blobUrl) => {
					if (resolvedFor !== src) return;
					if (blobUrl) {
						imageElement.src = blobUrl;
						imageElement.classList.remove('attachment-missing');
					} else {
						imageElement.classList.add('attachment-missing');
					}
				});
			};

			render();

			return {
				dom: imageElement,
				update(updatedNode) {
					if (updatedNode.type !== currentNode.type) return false;
					currentNode = updatedNode;
					render();
					return true;
				},
				ignoreMutation: () => true
			};
		};
	}
});
