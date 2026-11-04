// AES-256-GCM `enc1:` envelopes for scripts that run inside the production container, where there
// is no src/ and no TypeScript (sprint 037-CL). A plain-JS copy of src/lib/server/crypto/field-encryption.ts;
// scripts/lib/script-lib.test.ts checks that each side opens what the other sealed.
//
// Text envelope:  `enc1:<iv b64>:<tag b64>:<ciphertext b64>`.
// Bytes envelope: the ASCII bytes `enc1:` followed by iv (12) + tag (16) + ciphertext.
// Values without the prefix are legacy plaintext and pass through the decrypt functions untouched.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const ENVELOPE_PREFIX = 'enc1:';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PREFIX_BYTES = Buffer.from(ENVELOPE_PREFIX, 'ascii');

export class FieldDecryptionError extends Error {
	constructor(fieldName, reason) {
		super(
			`Cannot decrypt ${fieldName}: ${reason}. ` +
				'Check that ENCRYPTION_KEY is the key that was live when this value was written.'
		);
		this.name = 'FieldDecryptionError';
	}
}

/** Decodes a base64 (standard or url-safe) ENCRYPTION_KEY of 32 bytes; never echoes the key. */
export function decodeEncryptionKey(rawKey) {
	const trimmedKey = String(rawKey ?? '').trim();
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

export function isEncrypted(value) {
	return typeof value === 'string' && value.startsWith(ENVELOPE_PREFIX);
}

export function isEncryptedBytes(value) {
	return value.length >= PREFIX_BYTES.length && PREFIX_BYTES.equals(Buffer.from(value.subarray(0, PREFIX_BYTES.length)));
}

function sealBytes(plainBytes, key) {
	const initialisationVector = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, initialisationVector);
	const ciphertext = Buffer.concat([cipher.update(plainBytes), cipher.final()]);
	return { initialisationVector, authTag: cipher.getAuthTag(), ciphertext };
}

function openBytes(initialisationVector, authTag, ciphertext, key, fieldName) {
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

export function encrypt(plaintext, key) {
	if (isEncrypted(plaintext)) return plaintext;
	const { initialisationVector, authTag, ciphertext } = sealBytes(Buffer.from(plaintext, 'utf8'), key);
	return ['enc1', initialisationVector.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decrypt(storedValue, key, fieldName = 'field') {
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

/** `decrypt` for a nullable column. */
export function decryptNullable(storedValue, key, fieldName = 'field') {
	return storedValue === null || storedValue === undefined ? null : decrypt(storedValue, key, fieldName);
}

export function encryptBytes(plainBytes, key) {
	if (isEncryptedBytes(plainBytes)) return Buffer.from(plainBytes);
	const { initialisationVector, authTag, ciphertext } = sealBytes(Buffer.from(plainBytes), key);
	return Buffer.concat([PREFIX_BYTES, initialisationVector, authTag, ciphertext]);
}

export function decryptBytes(storedBytes, key, fieldName = 'field') {
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
