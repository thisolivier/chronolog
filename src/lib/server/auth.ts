import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins';
import { database } from '$lib/server/db';
import * as authSchema from '$lib/server/db/auth-schema';
import { getServerEnvironment } from '$lib/server/env';

// Throws at boot when BETTER_AUTH_SECRET / ENCRYPTION_KEY are missing (not during build).
const serverEnvironment = getServerEnvironment();

export const auth = betterAuth({
	secret: serverEnvironment.betterAuthSecret,
	baseURL: serverEnvironment.betterAuthUrl,
	database: drizzleAdapter(database, {
		provider: 'pg',
		schema: authSchema
	}),
	emailAndPassword: {
		enabled: true,
		// Registration is closed unless ALLOW_REGISTRATION=true; Better Auth then
		// rejects POST /api/auth/sign-up/email itself.
		disableSignUp: !serverEnvironment.allowRegistration
	},
	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days in seconds
		updateAge: 60 * 60 * 24 // refresh session daily
	},
	// BETTER_AUTH_URL plus any comma-separated TRUSTED_ORIGINS entries.
	trustedOrigins: serverEnvironment.trustedOrigins,
	plugins: [
		twoFactor({
			issuer: 'Chronolog'
		})
	]
});

export type Session = typeof auth.$Infer.Session;
