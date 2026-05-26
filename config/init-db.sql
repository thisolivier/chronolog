-- PowerSync replication setup for Chronolog (Docker init)
-- Runs at first DB initialization, before migrations create tables.

-- Create a replication role for PowerSync
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'powersync_repl') THEN
    CREATE ROLE powersync_repl WITH REPLICATION LOGIN PASSWORD 'powersync_repl_password';
  END IF;
END
$$;

-- Grant read access on the public schema
GRANT USAGE ON SCHEMA public TO powersync_repl;

-- Ensure tables created later (by migrations) are readable by the replication role
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync_repl;

-- Publish ALL tables. Tables created by later migrations are automatically included.
-- Publication name must be 'powersync' (the PowerSync service default).
CREATE PUBLICATION powersync FOR ALL TABLES;
