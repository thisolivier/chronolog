#!/usr/bin/env node
// Sets `notes.word_count` for notes stored with 0 words but non-empty content (sprint 037-CL):
// notes created over the API before `POST /api/notes` counted markdown (sprint 034's CLI notes).
//
// Production (inside the running container, which has DATABASE_URL and ENCRYPTION_KEY):
//   docker exec chronolog-prod-app node scripts/backfill-note-word-counts.mjs --dry-run
//   docker exec chronolog-prod-app node scripts/backfill-note-word-counts.mjs --apply
// Dev:  node --env-file=.env scripts/backfill-note-word-counts.mjs --dry-run
//
// Plain JS with production dependencies only (postgres) and scripts/lib/, so it runs in the
// image, which has no src/. Counts with the app's rules (TipTap JSON when present, else the
// markdown). Updates `word_count` only, and only where it is still 0. Trashed notes included.
// Idempotent. Take a backup before --apply (scripts/backup-postgres.sh).
import postgres from 'postgres';
import { decodeEncryptionKey, decryptNullable } from './lib/envelope.mjs';
import { noteWordCount } from './lib/word-count.mjs';

const TAG = '[backfill-note-word-counts]';
const isDryRun = process.argv.includes('--dry-run');
const isApply = process.argv.includes('--apply');
if (isDryRun === isApply) {
	console.error(`${TAG} give exactly one of --dry-run or --apply.`);
	process.exit(2);
}
if (!process.env.DATABASE_URL) {
	console.error(`${TAG} DATABASE_URL is not set.`);
	process.exit(1);
}
let key;
try {
	key = decodeEncryptionKey(process.env.ENCRYPTION_KEY ?? '');
} catch (keyError) {
	console.error(`${TAG} ${keyError.message}`);
	process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

try {
	const rows = await sql`
		select id, content, content_json from notes
		where word_count = 0 and (content is not null or content_json is not null)
		order by id`;
	const updates = [];
	for (const row of rows) {
		const content = decryptNullable(row.content, key, 'notes.content');
		const contentJson = decryptNullable(row.content_json, key, 'notes.content_json');
		const words = noteWordCount(content, contentJson);
		if (words > 0) updates.push({ id: row.id, words });
	}
	console.log(`${TAG} ${rows.length} note(s) with word_count 0 and some content; ${updates.length} have words.`);

	if (isDryRun) {
		const samples = updates.slice(0, 5).map((update) => `${update.id} (${update.words} words)`);
		console.log(`${TAG} dry run: ${updates.length} note(s) would be updated.`);
		if (samples.length) console.log(`${TAG} sample: ${samples.join(', ')}`);
	} else {
		let updatedCount = 0;
		await sql.begin(async (transaction) => {
			for (const update of updates) {
				// Still 0: a save since the read has already set the right count
				const result = await transaction`update notes set word_count = ${update.words} where id = ${update.id} and word_count = 0`;
				updatedCount += result.count;
			}
		});
		console.log(`${TAG} updated ${updatedCount} note(s).`);
	}
} catch (backfillError) {
	console.error(`${TAG} failed, nothing was changed:`, backfillError.message);
	process.exitCode = 1;
} finally {
	await sql.end();
}
