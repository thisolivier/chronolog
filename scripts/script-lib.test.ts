/**
 * Sprint 037-CL: the plain-JS copies in scripts/lib/ (run inside the production container, which
 * has no src/) must agree with the app's TypeScript: the envelope opens both ways and the word
 * counters give the same numbers on the same fixtures.
 */
import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import * as appEnvelope from '../src/lib/server/crypto/field-encryption';
import * as appCounts from '../src/lib/server/db/queries/note-word-count';
// @ts-expect-error plain JS module without types
import * as scriptEnvelope from './lib/envelope.mjs';
// @ts-expect-error plain JS module without types
import * as scriptCounts from './lib/word-count.mjs';

const rawKey = randomBytes(32).toString('base64');

describe('scripts/lib/envelope.mjs', () => {
	it('decodes the key the same way and opens what the app sealed, and the reverse', () => {
		const appKey = appEnvelope.decodeEncryptionKey(rawKey);
		const scriptKey = scriptEnvelope.decodeEncryptionKey(rawKey);
		expect(Buffer.compare(appKey, scriptKey)).toBe(0);

		const text = 'Status: café ☕ — 3 lines\nsecond';
		expect(scriptEnvelope.decrypt(appEnvelope.encrypt(text, appKey), scriptKey)).toBe(text);
		expect(appEnvelope.decrypt(scriptEnvelope.encrypt(text, scriptKey), appKey)).toBe(text);

		const bytes = randomBytes(64);
		expect(Buffer.compare(scriptEnvelope.decryptBytes(appEnvelope.encryptBytes(bytes, appKey), scriptKey), bytes)).toBe(0);
		expect(Buffer.compare(appEnvelope.decryptBytes(scriptEnvelope.encryptBytes(bytes, scriptKey), appKey), bytes)).toBe(0);
	});

	it('passes plaintext and null through, and refuses a wrong key', () => {
		const key = scriptEnvelope.decodeEncryptionKey(rawKey);
		expect(scriptEnvelope.decryptNullable(null, key)).toBeNull();
		expect(scriptEnvelope.decryptNullable('legacy plaintext', key)).toBe('legacy plaintext');
		const otherKey = scriptEnvelope.decodeEncryptionKey(randomBytes(32).toString('base64'));
		expect(() => scriptEnvelope.decrypt(scriptEnvelope.encrypt('x', key), otherKey, 'notes.content')).toThrow(/notes\.content/);
		expect(() => scriptEnvelope.decodeEncryptionKey('short')).toThrow(/32 bytes/);
	});
});

const markdownFixtures = [
	'',
	'# Status: checkout\n\nSecretary rewrite\n',
	'## Plan\n\n- one item\n- [ ] a task\n- [x] done task\n1. first\n2) second\n',
	'> quoted *emphasis* and **bold** and `code`\n\n---\n\n```js\nconst x = 1;\n```\n',
	'See [the doc](https://example.com/a) and ![diagram](chronolog://attachment/abc) and [[ACME.20261104.001]]',
	'Prices | Qty\n--- | ---\n€10 | 3\n',
	'Ünïcödé wörds — and 42 numbers ✓'
];

function paragraphs(...texts: string[]) {
	return JSON.stringify({
		type: 'doc',
		content: texts.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] }))
	});
}

const jsonFixtures = [
	paragraphs('Typed in the browser'),
	paragraphs('one two  three', '', 'four\tfive'),
	JSON.stringify({ type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: 'Title here' }] }, { type: 'horizontalRule' }] }),
	'{"type":"doc"}',
	'not json'
];

describe('scripts/lib/word-count.mjs', () => {
	it.each(markdownFixtures)('markdown counts agree: %j', (markdown) => {
		expect(scriptCounts.calculateWordCountFromMarkdown(markdown)).toBe(appCounts.calculateWordCountFromMarkdown(markdown));
	});

	it.each(jsonFixtures)('TipTap JSON counts agree: %j', (contentJson) => {
		expect(scriptCounts.calculateWordCountFromJson(contentJson)).toBe(appCounts.calculateWordCountFromJson(contentJson));
	});

	it('noteWordCount prefers the JSON, else the markdown (the app rule)', () => {
		expect(scriptCounts.noteWordCount('# Heading\n\nfour words of body', null)).toBe(5);
		expect(scriptCounts.noteWordCount('ignored markdown here', paragraphs('two words'))).toBe(2);
		expect(scriptCounts.noteWordCount(null, null)).toBe(0);
	});
});
