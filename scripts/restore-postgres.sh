#!/usr/bin/env bash
# Restore a Chronolog pg_dump (-Fc) file into a named database inside the Postgres container.
#
#   scripts/restore-postgres.sh <dump-file> <database-name>            # new database only
#   scripts/restore-postgres.sh --replace <dump-file> <database-name>  # drop and recreate first
#
# Restoring into a scratch name (e.g. chronolog_restore_check) is safe while the app runs.
# Replacing the live database (chronolog) requires the app container to be stopped first:
#   docker stop chronolog-prod-app && scripts/restore-postgres.sh --replace <dump> chronolog \
#     && docker start chronolog-prod-app
# The restored data is only readable with the ENCRYPTION_KEY that was live when the dump was taken.
# Prints exact row counts per table when done.
set -euo pipefail

CONTAINER="${CHRONOLOG_DB_CONTAINER:-chronolog-prod-postgres}"
APP_CONTAINER="${CHRONOLOG_APP_CONTAINER:-chronolog-prod-app}"
DB_USER="${CHRONOLOG_DB_USER:-chronolog}"
LIVE_DB="${CHRONOLOG_DB_NAME:-chronolog}"
DOCKER="${DOCKER:-docker}"

fail() { echo "restore-postgres: $*" >&2; exit 1; }
usage() { fail "usage: $0 [--replace] <dump-file> <database-name>"; }

REPLACE=false
if [[ "${1:-}" == "--replace" ]]; then REPLACE=true; shift; fi
[[ $# -eq 2 ]] || usage
DUMP_FILE="$1"
TARGET_DB="$2"

[[ -s "$DUMP_FILE" ]] || fail "dump file '$DUMP_FILE' is missing or empty"
[[ "$TARGET_DB" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || fail "database name must match ^[a-z_][a-z0-9_]*$"
[[ "$("$DOCKER" inspect --format '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" == "true" ]] \
	|| fail "container $CONTAINER is not running"

psql_admin() { "$DOCKER" exec -i "$CONTAINER" psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -Atq "$@"; }

"$DOCKER" exec -i "$CONTAINER" pg_restore --list < "$DUMP_FILE" > /dev/null \
	|| fail "'$DUMP_FILE' is not a readable pg_dump custom-format archive"

exists="$(psql_admin -c "select 1 from pg_database where datname = '$TARGET_DB'")"
if [[ "$exists" == "1" ]]; then
	$REPLACE || fail "database '$TARGET_DB' already exists (pass --replace to drop and recreate it)"
	if [[ "$TARGET_DB" == "$LIVE_DB" && "$("$DOCKER" inspect --format '{{.State.Running}}' "$APP_CONTAINER" 2>/dev/null)" == "true" ]]; then
		fail "stop $APP_CONTAINER before replacing the live database '$LIVE_DB'"
	fi
	echo "==> Dropping existing database $TARGET_DB"
	psql_admin -c "drop database \"$TARGET_DB\" with (force)"
fi

echo "==> Creating database $TARGET_DB"
psql_admin -c "create database \"$TARGET_DB\" owner \"$DB_USER\""

echo "==> Restoring $(basename "$DUMP_FILE") into $TARGET_DB"
"$DOCKER" exec -i "$CONTAINER" pg_restore -U "$DB_USER" -d "$TARGET_DB" --no-owner --no-privileges --exit-on-error < "$DUMP_FILE"

echo "==> Row counts in $TARGET_DB"
"$DOCKER" exec -i "$CONTAINER" psql -U "$DB_USER" -d "$TARGET_DB" -v ON_ERROR_STOP=1 -At -F ' ' -c "
select table_schema || '.' || table_name,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
from information_schema.tables
where table_schema in ('public', 'drizzle') and table_type = 'BASE TABLE'
order by 1"
echo "Restore complete."
