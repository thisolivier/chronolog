#!/usr/bin/env bash
# Nightly logical backup of the Chronolog production database.
#
#   pg_dump -Fc (inside the Postgres container) -> $BACKUP_ROOT/daily/chronolog-<UTC stamp>.dump
#   verified with pg_restore --list, promoted to weekly/ on Sundays (UTC),
#   pruned to KEEP_DAILY / KEEP_WEEKLY, mirrored to the Rabbit4TB volume when it is mounted.
#
# Run by launchd (scripts/launchd/com.olivier.chronolog-db-backup.plist) at 03:30, or by hand.
# Follows the musicLibrary db-backup precedent: UTC-stamped monthly log in $BACKUP_ROOT/logs,
# absolute docker path (launchd has a minimal PATH), guarded pruning.
#
# Exit codes: 0 ok; 1 dump/verify/mirror failed; 2 database container not running.
# Every setting can be overridden from the environment (used by the sprint-022 verification).
set -uo pipefail

BACKUP_ROOT="${CHRONOLOG_BACKUP_ROOT:-$HOME/Backups/chronolog}"
MIRROR_VOLUME="${CHRONOLOG_BACKUP_MIRROR_VOLUME:-/Volumes/Rabbit4TB}"
MIRROR_ROOT="${CHRONOLOG_BACKUP_MIRROR_ROOT:-$MIRROR_VOLUME/Backups/chronolog}"
CONTAINER="${CHRONOLOG_DB_CONTAINER:-chronolog-prod-postgres}"
DB_USER="${CHRONOLOG_DB_USER:-chronolog}"
DB_NAME="${CHRONOLOG_DB_NAME:-chronolog}"
KEEP_DAILY="${CHRONOLOG_KEEP_DAILY:-14}"
KEEP_WEEKLY="${CHRONOLOG_KEEP_WEEKLY:-8}"
DOCKER="${DOCKER:-/usr/local/bin/docker}"   # absolute: launchd runs with a minimal PATH
[[ -x "$DOCKER" ]] || DOCKER="$(command -v docker || echo docker)"

DAILY_DIR="$BACKUP_ROOT/daily"
WEEKLY_DIR="$BACKUP_ROOT/weekly"
LOG_DIR="$BACKUP_ROOT/logs"
umask 077
mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" "$LOG_DIR"
LOG_FILE="$LOG_DIR/backup-$(date -u +%Y-%m).log"

log() { # log <LEVEL> <message> — to the log file and stdout
	local line
	line="$(printf '%s [%s] %s' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2")"
	echo "$line" >> "$LOG_FILE"
	echo "$line"
}

finish() { log INFO "=== backup run end status=$1 ==="; exit "$1"; }

# prune_dir <dir> <keep> <guard-root>: keep the newest <keep> dumps (names sort by UTC stamp).
prune_dir() {
	local dir="$1" keep="$2" guard_root="$3" count=0 old
	case "$dir" in "$guard_root"/*) ;; *) log ERROR "prune refused: $dir is outside $guard_root"; return 1 ;; esac
	while IFS= read -r old; do
		[[ -z "$old" ]] && continue
		count=$((count + 1))
		if (( count > keep )); then
			rm -f "$old" && log INFO "pruned $(basename "$old") (keep $keep in $dir)"
		fi
	done <<< "$(ls -1 "$dir"/chronolog-*.dump 2>/dev/null | sort -r)"
}

mirror_is_available() {
	[[ -d "$MIRROR_VOLUME" && -w "$MIRROR_VOLUME" ]] || return 1
	# A /Volumes path must be a real mount, not a leftover directory on the internal disk.
	if [[ "$MIRROR_VOLUME" == /Volumes/* ]]; then
		mount | grep -q " on ${MIRROR_VOLUME} (" || return 1
	fi
}

TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
log INFO "=== backup run start ts=$TIMESTAMP host=$(hostname -s) container=$CONTAINER db=$DB_NAME ==="

if [[ "$("$DOCKER" inspect --format '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" != "true" ]]; then
	log ERROR "container $CONTAINER is not running; nothing dumped"
	finish 2
fi

# 1. Dump to a partial file, verify, then rename into place.
DUMP_NAME="chronolog-$TIMESTAMP.dump"
PARTIAL="$DAILY_DIR/.$DUMP_NAME.partial"
if ! "$DOCKER" exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$PARTIAL" 2>>"$LOG_FILE"; then
	rm -f "$PARTIAL"; log ERROR "pg_dump failed"; finish 1
fi
if [[ ! -s "$PARTIAL" ]]; then
	rm -f "$PARTIAL"; log ERROR "pg_dump produced an empty file"; finish 1
fi
TOC_ENTRIES="$("$DOCKER" exec -i "$CONTAINER" pg_restore --list < "$PARTIAL" 2>>"$LOG_FILE" | grep -c ' TABLE DATA ')" || TOC_ENTRIES=0
if (( TOC_ENTRIES == 0 )); then
	mv "$PARTIAL" "$DAILY_DIR/$DUMP_NAME.CORRUPT"; log ERROR "pg_restore --list found no table data; kept as $DUMP_NAME.CORRUPT"; finish 1
fi
mv "$PARTIAL" "$DAILY_DIR/$DUMP_NAME"
log INFO "dumped $DUMP_NAME ($(du -h "$DAILY_DIR/$DUMP_NAME" | cut -f1), $TOC_ENTRIES tables with data)"

# 2. Weekly promotion on Sunday (UTC), like the musicLibrary job.
if [[ "$(date -u +%u)" == "7" || "${CHRONOLOG_FORCE_WEEKLY:-false}" == "true" ]]; then
	cp -p "$DAILY_DIR/$DUMP_NAME" "$WEEKLY_DIR/$DUMP_NAME" && log INFO "promoted $DUMP_NAME to weekly"
fi

# 3. Retention.
RUN_STATUS=0
prune_dir "$DAILY_DIR" "$KEEP_DAILY" "$BACKUP_ROOT" || RUN_STATUS=1
prune_dir "$WEEKLY_DIR" "$KEEP_WEEKLY" "$BACKUP_ROOT" || RUN_STATUS=1

# 4. Mirror (copy new files, then apply the same retention on the mirror).
if mirror_is_available; then
	if mkdir -p "$MIRROR_ROOT/daily" "$MIRROR_ROOT/weekly" \
		&& rsync -a --exclude '.*' "$DAILY_DIR/" "$MIRROR_ROOT/daily/" 2>>"$LOG_FILE" \
		&& rsync -a --exclude '.*' "$WEEKLY_DIR/" "$MIRROR_ROOT/weekly/" 2>>"$LOG_FILE"; then
		prune_dir "$MIRROR_ROOT/daily" "$KEEP_DAILY" "$MIRROR_ROOT" || RUN_STATUS=1
		prune_dir "$MIRROR_ROOT/weekly" "$KEEP_WEEKLY" "$MIRROR_ROOT" || RUN_STATUS=1
		log INFO "mirrored to $MIRROR_ROOT"
	else
		log ERROR "mirror to $MIRROR_ROOT failed (local backup is intact)"
		RUN_STATUS=1
	fi
else
	log WARN "mirror volume $MIRROR_VOLUME not mounted; skipped mirror"
fi

finish "$RUN_STATUS"
