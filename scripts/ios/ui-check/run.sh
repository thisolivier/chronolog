#!/usr/bin/env bash
# run.sh <simulator-udid> <dev-server-url> <device-key> <user-email> [test name]
# Runs the UI tests against the installed debug shell. See README.md.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; repo="$(cd "$here/../../.." && pwd)"
simulator="$1"; export TEST_RUNNER_SHELL_URL="$2" TEST_RUNNER_DEVICE_KEY="$3" TEST_RUNNER_USER_EMAIL="$4"
export TEST_RUNNER_USER_PASSWORD='IosShell048!pass'
export TEST_RUNNER_SHOT_DIR="${SHOT_DIR:-$repo/docs/review/screenshots/sprint-048}"
only=(); [[ $# -ge 5 ]] && only=(-only-testing:"DriverUITests/ShellTests/$5")
link_page="$repo/static/ios-link-test.html"
printf '%s\n' '<!doctype html><meta name="viewport" content="width=device-width"><title>link test</title>' \
  '<body style="font:20px -apple-system;padding:80px 24px"><p><a href="https://example.com/">Open example.com</a></p><p><a href="/time">Stay in app: timesheet</a></p></body>' >"$link_page"
trap 'rm -f "$link_page"' EXIT
cd "$here" && xcodegen generate --quiet
xcodebuild test -project UIDriver.xcodeproj -scheme DriverUITests -destination "platform=iOS Simulator,id=$simulator" \
  -derivedDataPath "$here/.build" ${only[@]+"${only[@]}"} 2>&1 | grep -E "error:|Test Case .*(passed|failed)|\*\* TEST"
