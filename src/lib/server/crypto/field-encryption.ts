/**
 * Field-level encryption at rest: AES-256-GCM envelopes for text and bytes.
 *
 * Pure module (only `node:crypto`, no SvelteKit imports) so Node scripts such as
 * `scripts/encrypt-existing.mjs` can import it directly. Server code uses the
 * key-bound helpers in `./server-cipher.ts` instead of calling this with a key.
 *
 * Text envelope:  `enc1:<iv b64>:<tag b64>:<ciphertext b64>` (stays a text column).
 * Bytes envelope: the ASCII bytes `enc1:` followed by iv (12) + tag (16) + ciphertext.
 * Values without the prefix are legacy plaintext and pass through `decrypt` untouched,
 * so a database that predates encryption keeps working until it is migrated.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const ENVELOPE_PREFIX = 'enc1:';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PREFIX_BYTES = Buffer.from(ENVELOPE_PREFIX, 'ascii');

/** Thrown when a value carries the envelope prefix but cannot be decrypted. */
export class FieldDecryptionError extends Error {
	constructor(fieldName: string, reason: string) {
		super(
			`Cannot decrypt ${fieldName}: ${reason}. ` +
				'Check that ENCRYPTION_KEY is the key that was live when this value was written.'
		);
		this.name = 'FieldDecryptionError';
	}
}

/**
 * Decodes a base64 (standard or url-safe) ENCRYPTION_KEY and checks it is 32 bytes.
 * Throws with a message that never echoes the key.
 */
export function decodeEncryptionKey(rawKey: string): Buffer {
	const trimmedKey = rawKey.trim();
	if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(trimmedKey)) {
		throw new Error('ENCRYPTION_KEY must be base64 (generate with: openssl rand -base64 32).');
	}
	const keyBytes = Buffer.from(trimmedKey.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
	if (keyBytes.length !== KEY_LENGTH) {
		throw new Error(
			`ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes, got ${keyBytes.length} ` +
				'(generate with: openssl rand -base64 32).'
		);
	}
	return keyBytes;
}

export function isEncrypted(value: string): boolean {
	return value.startsWith(ENVELOPE_PREFIX);
}

export function isEncryptedBytes(value: Uint8Array): boolean {
	return value.length >= PREFIX_BYTES.length && PREFIX_BYTES.equals(Buffer.from(value.subarray(0, PREFIX_BYTES.length)));
}

function sealBytes(plainBytes: Buffer, key: Buffer) {
	const initialisationVector = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, initialisationVector);
	const ciphertext = Buffer.concat([cipher.update(plainBytes), cipher.final()]);
	return { initialisationVector, authTag: cipher.getAuthTag(), ciphertext };
}

function openBytes(
	initialisationVector: Buffer,
	authTag: Buffer,
	ciphertext: Buffer,
	key: Buffer,
	fieldName: string
): Buffer {
	if (initialisationVector.length !== IV_LENGTH || authTag.length !== TAG_LENGTH) {
		throw new FieldDecryptionError(fieldName, 'malformed envelope');
	}
	try {
		const decipher = createDecipheriv(ALGORITHM, key, initialisationVector);
		decipher.setAuthTag(authTag);
		return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	} catch {
		throw new FieldDecryptionError(fieldName, 'authentication failed (wrong key or tampered value)');
	}
}

/** Encrypts a string into an `enc1:` envelope. Already-encrypted values are returned as-is. */
export function encrypt(plaintext: string, key: Buffer): string {
	if (isEncrypted(plaintext)) return plaintext;
	const { initialisationVector, authTag, ciphertext } = sealBytes(Buffer.from(plaintext, 'utf8'), key);
	return [
		'enc1',
		initialisationVector.toString('base64'),
		authTag.toString('base64'),
		ciphertext.toString('base64')
	].join(':');
}

/** Decrypts an `enc1:` envelope; plaintext without the prefix passes through. */
export function decrypt(storedValue: string, key: Buffer, fieldName = 'field'): string {
	if (!isEncrypted(storedValue)) return storedValue;
	const parts = storedValue.split(':');
	if (parts.length !== 4) throw new FieldDecryptionError(fieldName, 'malformed envelope');
	const [, ivPart, tagPart, ciphertextPart] = parts;
	return openBytes(
		Buffer.from(ivPart, 'base64'),
		Buffer.from(tagPart, 'base64'),
		Buffer.from(ciphertextPart, 'base64'),
		key,
		fieldName
	).toString('utf8');
}

/** Encrypts bytes into the binary `enc1:` envelope. Already-encrypted bytes are returned as-is. */
export function encryptBytes(plainBytes: Uint8Array, key: Buffer): Buffer {
	if (isEncryptedBytes(plainBytes)) return Buffer.from(plainBytes);
	const { initialisationVector, authTag, ciphertext } = sealBytes(Buffer.from(plainBytes), key);
	return Buffer.concat([PREFIX_BYTES, initialisationVector, authTag, ciphertext]);
}

/** Decrypts a binary `enc1:` envelope; bytes without the prefix pass through. */
export function decryptBytes(storedBytes: Uint8Array, key: Buffer, fieldName = 'field'): Buffer {
	const storedBuffer = Buffer.from(storedBytes);
	if (!isEncryptedBytes(storedBuffer)) return storedBuffer;
	const headerEnd = PREFIX_BYTES.length;
	if (storedBuffer.length < headerEnd + IV_LENGTH + TAG_LENGTH) {
		throw new FieldDecryptionError(fieldName, 'malformed envelope');
	}
	return openBytes(
		storedBuffer.subarray(headerEnd, headerEnd + IV_LENGTH),
		storedBuffer.subarray(headerEnd + IV_LENGTH, headerEnd + IV_LENGTH + TAG_LENGTH),
		storedBuffer.subarray(headerEnd + IV_LENGTH + TAG_LENGTH),
		key,
		fieldName
	);
}
