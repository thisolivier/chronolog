#!/usr/bin/env node
// Hard-deletes notes that have been in the trash for more than 30 days, for every user
// (sprint 037-CL). The app already does this for a user each time they delete a note; this is
// for a manual run. The foreign keys cascade to the notes' links, time-entry links and attachments.
//
// Production:  docker exec chronolog-prod-app node scripts/purge-note-trash.mjs --dry-run
//              docker exec chronolog-prod-app node scripts/purge-note-trash.mjs --apply
// Dev:         node --env-file=.env scripts/purge-note-trash.mjs --dry-run
//
// Plain JS (postgres only), runs inside the production image. Take a backup before --apply.
import postgres from 'postgres';

/** Keep in sync with TRASH_RETENTION_DAYS in src/lib/server/db/queries/note-trash.ts */
const TRASH_RETENTION_DAYS = 30;
const TAG = '[purge-note-trash]';
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

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const expired = sql`deleted_at is not null and deleted_at < now() - make_interval(days => ${TRASH_RETENTION_DAYS})`;

try {
	if (isDryRun) {
		const rows = await sql`select id, deleted_at from notes where ${expired} order by deleted_at`;
		console.log(`${TAG} dry run: ${rows.length} note(s) trashed more than ${TRASH_RETENTION_DAYS} days ago would be purged.`);
		if (rows.length) console.log(`${TAG} sample: ${rows.slice(0, 5).map((row) => row.id).join(', ')}`);
	} else {
		const rows = await sql`delete from notes where ${expired} returning id`;
		console.log(`${TAG} purged ${rows.length} note(s).`);
	}
} catch (purgeError) {
	console.error(`${TAG} failed:`, purgeError.message);
	process.exitCode = 1;
} finally {
	await sql.end();
}
