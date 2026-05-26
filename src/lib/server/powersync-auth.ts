import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import type { JWK, KeyLike } from 'jose';

const POWERSYNC_KEY_ID = 'chronolog-dev-1';
const POWERSYNC_ALGORITHM = 'RS256';
const TOKEN_EXPIRATION_SECONDS = 60 * 60; // 1 hour

/**
 * In-memory RSA key pair, generated on first use and cached for the
 * lifetime of the server process. PowerSync fetches the JWKS endpoint
 * to verify tokens, so in-memory generation works fine -- keys rotate
 * on restart and PowerSync re-fetches automatically.
 */
let cachedKeyPair: { publicKey: KeyLike; privateKey: KeyLike } | null = null;

async function getOrCreateKeyPair(): Promise<{ publicKey: KeyLike; privateKey: KeyLike }> {
	if (cachedKeyPair) {
		return cachedKeyPair;
	}

	const keyPair = await generateKeyPair(POWERSYNC_ALGORITHM);
	cachedKeyPair = keyPair;
	return cachedKeyPair;
}

/**
 * Returns a JWKS (JSON Web Key Set) containing the public key.
 * PowerSync calls this endpoint to verify JWT signatures.
 */
export async function getJWKS(): Promise<{ keys: JWK[] }> {
	const { publicKey } = await getOrCreateKeyPair();
	const publicJwk = await exportJWK(publicKey);

	publicJwk.kid = POWERSYNC_KEY_ID;
	publicJwk.alg = POWERSYNC_ALGORITHM;

	return { keys: [publicJwk] };
}

/**
 * Generates a signed JWT for the single-user PowerSync connection.
 * No userId parameter is needed -- this is a simplified single-user flow.
 */
export async function generatePowerSyncToken(): Promise<{ token: string; expiresAt: number }> {
	const { privateKey } = await getOrCreateKeyPair();

	const issuedAt = Math.floor(Date.now() / 1000);
	const expiresAt = issuedAt + TOKEN_EXPIRATION_SECONDS;

	const token = await new SignJWT({})
		.setProtectedHeader({ alg: POWERSYNC_ALGORITHM, kid: POWERSYNC_KEY_ID })
		.setSubject('chronolog-user')
		.setAudience('powersync')
		.setIssuedAt(issuedAt)
		.setExpirationTime(expiresAt)
		.sign(privateKey);

	return { token, expiresAt };
}
