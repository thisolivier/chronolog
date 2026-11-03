#!/usr/bin/env bash
# Build and (re)start the Chronolog production stack, wait until healthy, print where it lives.
#
#   scripts/deploy-prod.sh            # uses .env.prod in the repo root
#   CHRONOLOG_ENV_FILE=/path/env scripts/deploy-prod.sh
#
# Safe to re-run: rebuilds the image, recreates only what changed, migrations are idempotent.
# Never prints secret values.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PROJECT_NAME="chronolog-prod"
COMPOSE_FILE="docker-compose.prod.yml"
APP_CONTAINER="chronolog-prod-app"
ENV_FILE="${CHRONOLOG_ENV_FILE:-.env.prod}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-180}"
DOCKER="${DOCKER:-docker}"

fail() { echo "deploy-prod: $*" >&2; exit 1; }

# Read one non-secret key from the env file without sourcing it.
read_env_value() {
	local key="$1" default_value="$2" line
	line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
	if [[ -n "$line" ]]; then echo "${line#*=}"; else echo "$default_value"; fi
}

[[ -f "$ENV_FILE" ]] || fail "$ENV_FILE not found. Copy .env.prod.example to .env.prod and fill it in."
if [[ "$(stat -f '%Lp' "$ENV_FILE" 2>/dev/null || echo 600)" != "600" ]]; then
	echo "deploy-prod: warning: $ENV_FILE is not mode 600 (chmod 600 $ENV_FILE)" >&2
fi
"$DOCKER" info >/dev/null 2>&1 || fail "docker is not reachable (is OrbStack running?)"

APP_PORT="$(read_env_value APP_PORT 3123)"
PUBLIC_URL="$(read_env_value BETTER_AUTH_URL '')"
ALLOW_REGISTRATION="$(read_env_value ALLOW_REGISTRATION false)"
DEVICE_ACCESS_KEY_HASH_VALUE="$(read_env_value DEVICE_ACCESS_KEY_HASH '')"

# Required secrets: presence only. The app validates their format at boot.
[[ -n "$DEVICE_ACCESS_KEY_HASH_VALUE" ]] || fail "DEVICE_ACCESS_KEY_HASH is missing or empty in $ENV_FILE. Generate it with: node scripts/generate-device-key.mjs"

# The port must be free, or already held by this stack.
port_owner="$("$DOCKER" ps --filter "publish=${APP_PORT}" --format '{{.Names}}' | head -n 1)"
if [[ -z "$port_owner" ]] && lsof -nP -iTCP:"$APP_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
	fail "port $APP_PORT is in use by a non-Docker process (see docs/ports.md)"
elif [[ -n "$port_owner" && "$port_owner" != "$APP_CONTAINER" ]]; then
	fail "port $APP_PORT is published by container $port_owner (see docs/ports.md)"
fi

compose() { "$DOCKER" compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

echo "==> Validating $COMPOSE_FILE"
compose config --quiet

echo "==> Building image and starting $PROJECT_NAME"
compose up -d --build --remove-orphans

echo "==> Waiting for $APP_CONTAINER to report healthy (timeout ${HEALTH_TIMEOUT_SECONDS}s)"
deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
while true; do
	status="$("$DOCKER" inspect --format '{{.State.Health.Status}}' "$APP_CONTAINER" 2>/dev/null || echo missing)"
	[[ "$status" == "healthy" ]] && break
	if [[ "$status" == "unhealthy" || $SECONDS -ge $deadline ]]; then
		echo "deploy-prod: $APP_CONTAINER is '$status'. Last log lines:" >&2
		"$DOCKER" logs --tail 40 "$APP_CONTAINER" >&2 || true
		exit 1
	fi
	sleep 2
done

echo
compose ps
echo
echo "Chronolog is up."
echo "  Local:  http://127.0.0.1:${APP_PORT}"
[[ -n "$PUBLIC_URL" ]] && echo "  Public: ${PUBLIC_URL}  (via the cloudflared tunnel, see docs/DEPLOYMENT.md)"
echo "  Registration: ALLOW_REGISTRATION=${ALLOW_REGISTRATION}"
cat <<'GUIDE'

First account (once per fresh database):
  1. Set ALLOW_REGISTRATION=true in .env.prod and re-run scripts/deploy-prod.sh.
  2. Open <public URL>/register and create the account; enable 2FA under Settings.
  3. Set ALLOW_REGISTRATION=false and re-run scripts/deploy-prod.sh.
  4. Confirm <public URL>/register now says registration is closed.
GUIDE
if [[ "$ALLOW_REGISTRATION" == "true" ]]; then
	echo
	echo "WARNING: registration is OPEN. Close it (step 3) as soon as the account exists." >&2
fi
