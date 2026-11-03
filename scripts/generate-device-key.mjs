#!/usr/bin/env node
// Generates a device access key and the scrypt hash the server is configured with.
//
//   node scripts/generate-device-key.mjs
//
// Prints the raw key (give it to browsers via /unlock, and to the CLI / Tauri app as the
// X-Device-Key header; keep it in the password manager) and the DEVICE_ACCESS_KEY_HASH line
// for .env / .env.prod. Only the hash goes on the server. Needs Node 22.18+ (imports a .ts
// module via Node's built-in type stripping); no dependencies beyond node:crypto.
import { generateDeviceKey, hashDeviceKey } from '../src/lib/server/device-gate/device-key.ts';

const rawKey = generateDeviceKey();
const configuredHash = hashDeviceKey(rawKey);

console.log('# Device access key — store in the password manager; never put it on the server.');
console.log(`DEVICE_ACCESS_KEY=${rawKey}`);
console.log('');
console.log('# Server configuration — add to .env (development) or .env.prod (production).');
console.log(`DEVICE_ACCESS_KEY_HASH=${configuredHash}`);
