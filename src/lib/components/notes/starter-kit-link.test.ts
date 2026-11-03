// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';

/**
 * Guards the sprint 020-CL fix for the duplicate `link` extension (QA §5).
 *
 * TipTap v3 StarterKit bundles Link. NoteEditor.svelte therefore passes the
 * link options through StarterKit (`link: { openOnClick: false }`) instead of
 * registering `@tiptap/extension-link` a second time.
 */
describe('StarterKit link configuration', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('registers exactly one link extension with openOnClick disabled when configured via StarterKit', () => {
		const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const editor = new Editor({
			extensions: [StarterKit.configure({ link: { openOnClick: false } })],
		});

		const linkExtensions = editor.extensionManager.extensions.filter(
			(extension) => extension.name === 'link',
		);
		expect(linkExtensions).toHaveLength(1);
		expect(linkExtensions[0].options.openOnClick).toBe(false);

		const duplicateWarnings = consoleWarnSpy.mock.calls.filter((callArguments) =>
			String(callArguments[0]).includes('Duplicate extension names'),
		);
		expect(duplicateWarnings).toHaveLength(0);

		editor.destroy();
	});

	it('warns about a duplicate link extension when Link is registered alongside default StarterKit', () => {
		const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const editor = new Editor({
			extensions: [StarterKit, Link.configure({ openOnClick: false })],
		});

		const duplicateWarnings = consoleWarnSpy.mock.calls.filter((callArguments) =>
			String(callArguments[0]).includes('Duplicate extension names'),
		);
		expect(duplicateWarnings.length).toBeGreaterThan(0);

		editor.destroy();
	});
});
