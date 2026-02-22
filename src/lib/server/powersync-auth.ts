import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import type { JWK, CryptoKey as JoseCryptoKey } from 'jose';

/**
 * RSA key pair management for PowerSync JWT authentication.
 *
 * Keys are generated once on first use and cached in memory for the
 * lifetime of the server process. In development this means keys rotate
 * on every server restart, which is fine because the PowerSync service
 * fetches the JWKS endpoint to validate tokens.
 */

const POWERSYNC_KEY_ID = 'powersync-dev-1';
const POWERSYNC_ALGORITHM = 'RS256';
const TOKEN_EXPIRATION_SECONDS = 60 * 60; // 1 hour

interface CachedKeyPair {
	privateKey: JoseCryptoKey;
	publicKeyJWK: JWK;
}

let cachedKeyPair: CachedKeyPair | null = null;

/**
 * Returns (or generates) the RSA key pair used for signing PowerSync JWTs.
 * The key pair is generated once and cached in memory.
 */
async function getOrCreateKeyPair(): Promise<CachedKeyPair> {
	if (cachedKeyPair) {
		return cachedKeyPair;
	}

	const { publicKey, privateKey } = await generateKeyPair(POWERSYNC_ALGORITHM);
	const publicKeyJWK = await exportJWK(publicKey);

	// Attach the key ID so PowerSync can match tokens to the correct key
	publicKeyJWK.kid = POWERSYNC_KEY_ID;
	publicKeyJWK.alg = POWERSYNC_ALGORITHM;

	cachedKeyPair = { privateKey, publicKeyJWK };
	return cachedKeyPair;
}

/**
 * Returns the public key in JWKS (JSON Web Key Set) format.
 * This is served at the JWKS endpoint for PowerSync to verify tokens.
 */
export async function getJWKS(): Promise<{ keys: JWK[] }> {
	const { publicKeyJWK } = await getOrCreateKeyPair();
	return { keys: [publicKeyJWK] };
}

/**
 * Generates a signed JWT for the given user, suitable for authenticating
 * with the PowerSync service.
 *
 * @param userId - The authenticated user's ID (becomes the `sub` claim)
 * @returns An object containing the signed token string and its expiration timestamp
 */
export async function generatePowerSyncToken(
	userId: string
): Promise<{ token: string; expiresAt: number }> {
	const { privateKey } = await getOrCreateKeyPair();

	const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_EXPIRATION_SECONDS;

	const token = await new SignJWT({})
		.setProtectedHeader({ alg: POWERSYNC_ALGORITHM, kid: POWERSYNC_KEY_ID })
		.setSubject(userId)
		.setAudience('powersync')
		.setIssuedAt()
		.setExpirationTime(expiresAt)
		.sign(privateKey);

	return { token, expiresAt };
}
