#!/usr/bin/env node
// One-time migration for a database that predates sprint 023 (encryption at rest).
//
//   node --env-file=.env scripts/encrypt-existing.mjs          # or export DATABASE_URL + ENCRYPTION_KEY
//   node --env-file=.env scripts/encrypt-existing.mjs --dry-run
//
// Walks every encrypted column and encrypts plaintext values in place with ENCRYPTION_KEY.
// Idempotent: values already carrying the `enc1:` prefix are skipped, so re-running is safe.
// Take a backup first (scripts/backup-postgres.sh). A fresh database needs nothing.
// The envelope is scripts/lib/envelope.mjs (a plain-JS copy of the app's field-encryption.ts,
// tested to agree with it), so this also runs inside the production container.
import postgres from 'postgres';
import {
	decodeEncryptionKey,
	decrypt,
	decryptBytes,
	encrypt,
	encryptBytes,
	isEncrypted,
	isEncryptedBytes
} from './lib/envelope.mjs';

/** Every column encrypted at rest. Keep in sync with the query modules. */
const ENCRYPTED_COLUMNS = [
	{ table: 'clients', column: 'name', kind: 'text' },
	{ table: 'contracts', column: 'name', kind: 'text' },
	{ table: 'contracts', column: 'description', kind: 'text' },
	{ table: 'time_entries', column: 'description', kind: 'text' },
	{ table: 'notes', column: 'title', kind: 'text' },
	{ table: 'notes', column: 'content', kind: 'text' },
	{ table: 'notes', column: 'content_json', kind: 'text' },
	{ table: 'attachments', column: 'filename', kind: 'text' },
	{ table: 'attachments', column: 'data', kind: 'bytes' }
];

const isDryRun = process.argv.includes('--dry-run');
const databaseUrl = process.env.DATABASE_URL;
const rawKey = process.env.ENCRYPTION_KEY ?? '';

if (!databaseUrl) {
	console.error('[encrypt-existing] DATABASE_URL is not set.');
	process.exit(1);
}

let key;
try {
	key = decodeEncryptionKey(rawKey);
} catch (keyError) {
	console.error(`[encrypt-existing] ${keyError.message}`);
	process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

/** Encrypts one column's plaintext rows inside `transaction`; returns { scanned, encrypted }. */
async function encryptColumn(transaction, { table, column, kind }) {
	const rows = await transaction`select id, ${transaction(column)} as value from ${transaction(table)} where ${transaction(column)} is not null`;
	let encryptedCount = 0;
	for (const row of rows) {
		const alreadyEncrypted = kind === 'bytes' ? isEncryptedBytes(row.value) : isEncrypted(row.value);
		if (alreadyEncrypted) {
			// Refuse to mix keys: existing ciphertext must open with the key we are about to use.
			// Throws FieldDecryptionError naming table.column, which rolls the transaction back.
			if (kind === 'bytes') decryptBytes(row.value, key, `${table}.${column}`);
			else decrypt(row.value, key, `${table}.${column}`);
			continue;
		}
		encryptedCount += 1;
		if (isDryRun) continue;
		const sealedValue = kind === 'bytes' ? encryptBytes(row.value, key) : encrypt(row.value, key);
		await transaction`update ${transaction(table)} set ${transaction(column)} = ${sealedValue} where id = ${row.id}`;
	}
	return { scanned: rows.length, encrypted: encryptedCount };
}

try {
	let totalEncrypted = 0;
	// One transaction for every column, so a failure (e.g. a bad key) leaves the database untouched.
	await sql.begin(async (transaction) => {
		for (const target of ENCRYPTED_COLUMNS) {
			const { scanned, encrypted } = await encryptColumn(transaction, target);
			totalEncrypted += encrypted;
			console.log(
				`[encrypt-existing] ${target.table}.${target.column}: ${scanned} non-null, ` +
					`${encrypted} ${isDryRun ? 'would be encrypted' : 'encrypted'}, ` +
					`${scanned - encrypted} already encrypted`
			);
		}
	});
	console.log(
		`[encrypt-existing] done: ${totalEncrypted} value(s) ${isDryRun ? 'would be encrypted (dry run)' : 'encrypted'}.`
	);
} catch (migrationError) {
	console.error('[encrypt-existing] failed, nothing was changed:', migrationError.message);
	process.exitCode = 1;
} finally {
	await sql.end();
}
