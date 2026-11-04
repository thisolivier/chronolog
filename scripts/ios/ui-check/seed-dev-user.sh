#!/usr/bin/env bash
# seed-dev-user.sh <base-url> <device-key> — a fresh user with one client, contract, note and
# time entry on a LOCAL dev server (registration on). Prints the email; the password is fixed.
# Never point this at production.
set -euo pipefail
base_url="$1"; device_key="$2"
case "$base_url" in http://localhost:*|http://127.0.0.1:*) ;; *) echo "local dev servers only" >&2; exit 1 ;; esac
cookie_jar="$(mktemp)"; trap 'rm -f "$cookie_jar"' EXIT
email="ios-shell-$(date +%s)@chronolog.test"
request() { curl -sf -H "X-Device-Key: $device_key" -H "Origin: $base_url" -H "Content-Type: application/json" -b "$cookie_jar" -c "$cookie_jar" "$@"; }
request -X POST "$base_url/api/auth/sign-up/email" -d "{\"name\":\"iOS Shell\",\"email\":\"$email\",\"password\":\"IosShell048!pass\"}" >/dev/null
contract_id="$(request -X POST "$base_url/api/contracts" -d '{"newClient":{"name":"Acme Studio","shortCode":"ACME"},"name":"Website rebuild","isActive":true}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).contract.id))')"
request -X POST "$base_url/api/notes" -d "{\"contractId\":\"$contract_id\",\"content\":\"# Kick-off notes\\n\\nAgreed scope for the website rebuild. Next: wireframes by Friday.\"}" >/dev/null
request -X POST "$base_url/api/time-entries" -d "{\"contractId\":\"$contract_id\",\"date\":\"$(date +%F)\",\"durationMinutes\":90,\"description\":\"Kick-off workshop\"}" >/dev/null
echo "$email"
