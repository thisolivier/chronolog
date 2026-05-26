/**
 * Password reset CLI for Chronolog.
 *
 * Usage:
 *   npx tsx scripts/reset-password.ts <email> <new-password>
 *   npm run db:reset-password -- user@example.com newpassword123
 *
 * Requires DATABASE_URL env var or defaults to local dev Postgres.
 */

import postgres from 'postgres';
import { hashPassword } from 'better-auth/crypto';

async function main() {
	const [email, newPassword] = process.argv.slice(2);

	if (!email || !newPassword) {
		console.error('Usage: npx tsx scripts/reset-password.ts <email> <new-password>');
		process.exit(1);
	}

	if (newPassword.length < 8) {
		console.error('Password must be at least 8 characters.');
		process.exit(1);
	}

	const connectionString =
		process.env.DATABASE_URL || 'postgresql://chronolog:chronolog@localhost:5432/chronolog';
	const sql = postgres(connectionString);

	try {
		// Find the user by email
		const users = await sql`SELECT id, name, email FROM "user" WHERE email = ${email}`;

		if (users.length === 0) {
			console.error(`No user found with email: ${email}`);
			process.exit(1);
		}

		const user = users[0];
		console.log(`Found user: ${user.name} (${user.email})`);

		// Hash the new password using Better Auth's built-in scrypt
		const hashedPassword = await hashPassword(newPassword);

		// Update the credential account's password
		const updated = await sql`
			UPDATE "account"
			SET password = ${hashedPassword}, updated_at = NOW()
			WHERE "user_id" = ${user.id} AND "provider_id" = 'credential'
			RETURNING id
		`;

		if (updated.length === 0) {
			console.error('No credential account found for this user. They may use a social login.');
			process.exit(1);
		}

		// Invalidate all existing sessions so the user must log in fresh
		const deletedSessions = await sql`
			DELETE FROM "session" WHERE "user_id" = ${user.id}
		`;

		console.log(`Password updated successfully for ${email}.`);
		console.log(`${deletedSessions.count} active session(s) invalidated.`);
	} finally {
		await sql.end();
	}
}

main().catch((error) => {
	console.error('Error:', error.message);
	process.exit(1);
});
