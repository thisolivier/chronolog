import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins';
import { database } from '$lib/server/db';
import * as authSchema from '$lib/server/db/auth-schema';

export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET || 'default-secret-for-development',
	baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:5173',
	database: drizzleAdapter(database, {
		provider: 'pg',
		schema: authSchema
	}),
	emailAndPassword: {
		enabled: true
	},
	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days in seconds
		updateAge: 60 * 60 * 24 // refresh session daily
	},
	plugins: [
		twoFactor({
			issuer: 'Chronolog'
		})
	]
});

export type Session = typeof auth.$Infer.Session;
