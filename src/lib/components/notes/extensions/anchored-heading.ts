import Heading from '@tiptap/extension-heading';
import { mergeAttributes } from '@tiptap/core';

/**
 * Generate a URL-friendly slug from text.
 *
 * "Design Review" -> "design-review"
 * "Phase 1 - Kickoff" -> "phase-1-kickoff"
 * "Special Ch@rs & Stuff!" -> "special-chrs-stuff"
 */
export function generateSlug(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

/**
 * AnchoredHeading extends TipTap's Heading node to auto-generate anchor IDs
 * from heading text content. This enables [[NOTE#heading-slug]] wiki-link
 * syntax to target specific sections within a note.
 *
 * IMPORTANT: Since StarterKit includes Heading by default, you must disable
 * the built-in Heading when using AnchoredHeading:
 *
 * ```ts
 * StarterKit.configure({ heading: false }),
 * AnchoredHeading,
 * ```
 */
export const AnchoredHeading = Heading.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			id: {
				default: null,
				rendered: true,
			},
		};
	},

	renderHTML({ node, HTMLAttributes }) {
		const level = node.attrs.level as number;
		const textContent = node.textContent;
		const slug = textContent ? generateSlug(textContent) : null;

		return [
			`h${level}`,
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, slug ? { id: slug } : {}),
			0,
		];
	},
});
