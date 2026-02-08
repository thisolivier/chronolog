/**
 * Sync query module: re-exports pull and push operations.
 *
 * Pull: fetches all entities changed since a timestamp for a user.
 * Push: applies a batch of entity mutations from the client with last-write-wins conflict resolution.
 *
 * @see sync-pull.ts for pull implementation details
 * @see sync-push.ts for push implementation and conflict resolution logic
 */
export { pullChangesSince } from './sync-pull';
export { pushChanges } from './sync-push';
