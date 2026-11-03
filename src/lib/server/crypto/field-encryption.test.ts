import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
	decodeEncryptionKey,
	decrypt,
	decryptBytes,
	encrypt,
	encryptBytes,
	FieldDecryptionError,
	isEncrypted,
	isEncryptedBytes
} from './field-encryption';

const key = randomBytes(32);
const otherKey = randomBytes(32);

/** Flips one character of the base64 tag segment of a text envelope. */
function tamperTag(envelope: string): string {
	const [prefix, iv, tag, ciphertext] = envelope.split(':');
	const tagBytes = Buffer.from(tag, 'base64');
	tagBytes[0] ^= 0xff;
	return [prefix, iv, tagBytes.toString('base64'), ciphertext].join(':');
}

describe('text envelope', () => {
	it('round-trips plaintext, including unicode and the empty string', () => {
		for (const plaintext of ['Big Cheese Inc.', 'Café — naïve 日本 🧀', '', '{"type":"doc"}']) {
			const envelope = encrypt(plaintext, key);
			expect(envelope.startsWith('enc1:')).toBe(true);
			expect(envelope).not.toContain(plaintext || 'never');
			expect(decrypt(envelope, key, 'clients.name')).toBe(plaintext);
		}
	});

	it('uses a fresh IV per value', () => {
		expect(encrypt('same', key)).not.toBe(encrypt('same', key));
	});

	it('detects the prefix and passes legacy plaintext through decrypt', () => {
		expect(isEncrypted(encrypt('x', key))).toBe(true);
		expect(isEncrypted('plain old text')).toBe(false);
		expect(decrypt('plain old text', key, 'notes.title')).toBe('plain old text');
	});

	it('does not double-encrypt a value that already has the prefix', () => {
		const envelope = encrypt('once', key);
		expect(encrypt(envelope, key)).toBe(envelope);
	});

	it('fails on a modified tag with an error naming the table and column', () => {
		const tampered = tamperTag(encrypt('secret', key));
		expect(() => decrypt(tampered, key, 'notes.content')).toThrow(FieldDecryptionError);
		expect(() => decrypt(tampered, key, 'notes.content')).toThrow(/notes\.content/);
	});

	it('fails with the wrong key and never returns ciphertext', () => {
		const envelope = encrypt('secret', key);
		expect(() => decrypt(envelope, otherKey, 'contracts.name')).toThrow(
			/Cannot decrypt contracts\.name: authentication failed/
		);
	});

	it('rejects a malformed envelope', () => {
		expect(() => decrypt('enc1:only-two', key, 'clients.name')).toThrow(/malformed envelope/);
	});
});

describe('bytes envelope', () => {
	it('round-trips binary data and is detectable by its prefix', () => {
		const original = randomBytes(4096);
		const sealed = encryptBytes(original, key);
		expect(isEncryptedBytes(sealed)).toBe(true);
		expect(isEncryptedBytes(original.subarray(0, 0))).toBe(false);
		expect(decryptBytes(sealed, key, 'attachments.data').equals(original)).toBe(true);
	});

	it('passes legacy plaintext bytes through and fails on tamper or wrong key', () => {
		const plainBytes = Buffer.from('fake-png-binary');
		expect(decryptBytes(plainBytes, key).equals(plainBytes)).toBe(true);

		const sealed = encryptBytes(plainBytes, key);
		const tampered = Buffer.from(sealed);
		tampered[5 + 12] ^= 0xff; // first tag byte
		expect(() => decryptBytes(tampered, key, 'attachments.data')).toThrow(/attachments\.data/);
		expect(() => decryptBytes(sealed, otherKey, 'attachments.data')).toThrow(FieldDecryptionError);
	});
});

describe('decodeEncryptionKey', () => {
	it('accepts standard and url-safe base64 of 32 bytes', () => {
		const raw = randomBytes(32);
		expect(decodeEncryptionKey(raw.toString('base64')).equals(raw)).toBe(true);
		expect(decodeEncryptionKey(raw.toString('base64url')).equals(raw)).toBe(true);
	});

	it('rejects other lengths without echoing the key', () => {
		const shortKey = randomBytes(16).toString('base64');
		expect(() => decodeEncryptionKey(shortKey)).toThrow(/32 bytes, got 16/);
		try {
			decodeEncryptionKey(shortKey);
		} catch (keyError) {
			expect((keyError as Error).message).not.toContain(shortKey);
		}
	});
});
