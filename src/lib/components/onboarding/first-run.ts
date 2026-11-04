/**
 * First-run detection (sprint 029-CL). A new account is seeded with one client, "Internal"
 * (`INTL`), holding a "General" contract (`ensureAppUser`). Until the person adds a client of
 * their own, the timesheet and the notes list explain where clients are created.
 */

export const STARTER_CLIENT = { name: 'Internal', shortCode: 'INTL' } as const;

export const CLIENTS_SETTINGS_HREF = '/admin/clients';

export function isStarterClient(client: { name: string; shortCode: string }): boolean {
	return client.shortCode === STARTER_CLIENT.shortCode && client.name === STARTER_CLIENT.name;
}

/** True when the person has no clients besides the seeded starter one. */
export function hasNoOwnClients(clients: Array<{ name: string; shortCode: string }>): boolean {
	return clients.every(isStarterClient);
}
