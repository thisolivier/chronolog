/**
 * Key-bound field encryption for server code (query modules only).
 *
 * Wraps the pure envelope functions in `./field-encryption.ts` with the
 * ENCRYPTION_KEY validated by `$lib/server/env`. Nullable helpers keep
 * `null` as `null` so optional columns stay optional.
 */

import { getServerEnvironment } from '$lib/server/env';
import * as envelope from './field-encryption';

export { FieldDecryptionError, isEncrypted, isEncryptedBytes } from './field-encryption';

function activeKey(): Buffer {
	return getServerEnvironment().encryptionKeyBytes;
}

export function encryptText(plaintext: string): string {
	return envelope.encrypt(plaintext, activeKey());
}

export function decryptText(storedValue: string, fieldName: string): string {
	return envelope.decrypt(storedValue, activeKey(), fieldName);
}

/** Encrypts strings; passes `null` / `undefined` through (so partial updates stay partial). */
export function encryptNullable<Value extends string | null | undefined>(plaintext: Value): Value {
	return (typeof plaintext === 'string' ? encryptText(plaintext) : plaintext) as Value;
}

export function decryptNullable(storedValue: string | null, fieldName: string): string | null {
	return storedValue === null ? null : decryptText(storedValue, fieldName);
}

export function encryptAttachmentBytes(plainBytes: Uint8Array): Buffer {
	return envelope.encryptBytes(plainBytes, activeKey());
}

export function decryptAttachmentBytes(storedBytes: Uint8Array, fieldName: string): Buffer {
	return envelope.decryptBytes(storedBytes, activeKey(), fieldName);
}
