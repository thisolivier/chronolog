# Backlog — Infrastructure (IF)

## IF-1: Containerised Remote Stack (Phase A)

Single Docker Compose on the remote machine with:
- Source Postgres (containerised, `wal_level=logical`)
- Bucket-storage Postgres (PowerSync internal state)
- PowerSync service (`journeyapps/powersync-service`, unified mode)
- SvelteKit app server

All services on the internal Docker network (no host-networking hacks).

**Unblocks:** IF-2, partially CL-2

## IF-2: Single-User Sync Rules + Schema (Phase B)

- Global bucket sync rules (one bucket, whole-table syncs, no per-user filtering)
- Resolve denormalised `user_id` columns from the spike (drop them — single-user constraint)
- Reconcile Drizzle migrations on a clean DB
- Simplified single-user JWT auth for PowerSync connection

**Depends on:** IF-1
**Unblocks:** CL-2
