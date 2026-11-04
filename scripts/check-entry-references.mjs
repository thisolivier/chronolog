// Reports (never fixes) time entries whose references do not hold together (sprint 032-CL):
// a contract that is not the entry owner's, a deliverable not on the entry's contract, a work type
// without a deliverable, or a work type under another deliverable. The app refuses all of these on
// write (src/lib/server/db/queries/entry-references.ts); this finds rows written before that.
//
//   node --env-file=.env scripts/check-entry-references.mjs [--json]
//
// Read-only (one READ ONLY transaction). Prints ids and the plaintext deliverable / work type
// names only; contract and client names are encrypted and never decrypted here.
// Exit 0 when every entry is consistent, 1 when some are not, 2 when it cannot run.
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error('[check-entry-references] DATABASE_URL is not set.');
	process.exit(2);
}
const asJson = process.argv.includes('--json');

const CHECKS = {
	contract_not_owned: 'contract belongs to another user',
	deliverable_mismatch: 'deliverable is not on the entry’s contract',
	work_type_without_deliverable: 'work type set but no deliverable',
	work_type_mismatch: 'work type is under another deliverable'
};

const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

try {
	const rows = await sql.begin('read only', (transaction) => transaction`
		select
			te.id as entry_id,
			te.user_id,
			te.date::text as date,
			te.is_draft,
			te.contract_id,
			te.deliverable_id,
			d.name as deliverable_name,
			d.contract_id as deliverable_contract_id,
			te.work_type_id,
			wt.name as work_type_name,
			wt.deliverable_id as work_type_deliverable_id,
			wd.name as work_type_deliverable_name,
			cl.user_id as contract_owner_id
		from time_entries te
		join contracts c on c.id = te.contract_id
		join clients cl on cl.id = c.client_id
		left join deliverables d on d.id = te.deliverable_id
		left join work_types wt on wt.id = te.work_type_id
		left join deliverables wd on wd.id = wt.deliverable_id
		where cl.user_id <> te.user_id
			or (te.deliverable_id is not null and d.contract_id <> te.contract_id)
			or (te.work_type_id is not null and te.deliverable_id is null)
			or (te.work_type_id is not null and wt.deliverable_id <> te.deliverable_id)
		order by te.user_id, te.date, te.id
	`);
	const [{ total }] = await sql`select count(*)::int as total from time_entries`;

	const problems = rows.map((row) => {
		const issues = [];
		if (row.contract_owner_id !== row.user_id) issues.push('contract_not_owned');
		if (row.deliverable_id && row.deliverable_contract_id !== row.contract_id) issues.push('deliverable_mismatch');
		if (row.work_type_id && !row.deliverable_id) issues.push('work_type_without_deliverable');
		if (row.work_type_id && row.deliverable_id && row.work_type_deliverable_id !== row.deliverable_id) {
			issues.push('work_type_mismatch');
		}
		return { ...row, issues };
	});
	const countsByIssue = Object.fromEntries(
		Object.keys(CHECKS).map((issue) => [issue, problems.filter((problem) => problem.issues.includes(issue)).length])
	);

	if (asJson) {
		console.log(JSON.stringify({ checkedEntries: total, inconsistentEntries: problems.length, countsByIssue, entries: problems }, null, 2));
	} else {
		console.log(`Checked ${total} time entries: ${problems.length} inconsistent.`);
		for (const [issue, label] of Object.entries(CHECKS)) console.log(`  ${issue.padEnd(30)} ${countsByIssue[issue]}  (${label})`);
		for (const problem of problems) {
			const workType = problem.work_type_id
				? ` work type "${problem.work_type_name}" (under "${problem.work_type_deliverable_name}")`
				: '';
			const deliverable = problem.deliverable_id ? ` deliverable "${problem.deliverable_name}"` : ' no deliverable';
			console.log(`- ${problem.entry_id} ${problem.date} user=${problem.user_id}${problem.is_draft ? ' [draft]' : ''}:${deliverable}${workType} → ${problem.issues.join(', ')}`);
		}
	}
	process.exitCode = problems.length ? 1 : 0;
} catch (failure) {
	console.error('[check-entry-references] failed:', failure.message);
	process.exitCode = 2;
} finally {
	await sql.end();
}
