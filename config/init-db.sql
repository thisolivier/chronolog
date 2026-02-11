-- PowerSync replication setup for Chronolog
--
-- Run this against your PostgreSQL database to configure replication for PowerSync.
-- Prerequisites:
--   1. wal_level must be set to 'logical':
--      ALTER SYSTEM SET wal_level = logical;
--      Then restart PostgreSQL.
--   2. Database migrations must have been applied (tables must exist).
--
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks).

-- Create a replication role for PowerSync
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'powersync_repl') THEN
    CREATE ROLE powersync_repl WITH REPLICATION LOGIN PASSWORD 'powersync_repl_password';
  END IF;
END
$$;

-- Grant read access to existing tables in the public schema
GRANT USAGE ON SCHEMA public TO powersync_repl;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync_repl;

-- Ensure future tables are also readable by the replication user
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync_repl;

-- Create a publication for all Chronolog tables used by PowerSync
-- (Drop first if exists to allow re-running)
DROP PUBLICATION IF EXISTS powersync_publication;
CREATE PUBLICATION powersync_publication FOR TABLE
  clients,
  contracts,
  deliverables,
  work_types,
  time_entries,
  notes,
  note_links,
  note_time_entries,
  weekly_statuses,
  attachments;
