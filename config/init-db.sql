-- PowerSync replication user setup
-- This script runs on first database initialization only.

-- Create a replication role for PowerSync
CREATE ROLE powersync_repl WITH REPLICATION LOGIN PASSWORD 'powersync_repl_password';

-- Grant read access to existing tables in the public schema
GRANT USAGE ON SCHEMA public TO powersync_repl;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync_repl;

-- Ensure future tables are also readable by the replication user
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync_repl;

-- Create a publication for all Chronolog tables used by PowerSync
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
