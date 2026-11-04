#!/usr/bin/env bash
# lib/version.sh — the ONE place that reads and writes the iOS build number.
#
# Ported from ~/sites/timeConvertor/scripts/lib/version.sh. There the build number lives in
# xcodegen's project.yml; here it lives in `src-tauri/tauri.ios.conf.json` as
# `bundle.iOS.bundleVersion`, because `tauri ios build` rewrites gen/apple's Info.plist
# (CFBundleVersion and CFBundleShortVersionString) from the Tauri config on every build — an edit
# to project.yml or Info.plist would be silently overwritten. The marketing version
# (CFBundleShortVersionString) comes from package.json through tauri.conf.json's `version`.
#
# Sourcing contract: the sourcing script must already define `fail <step>` (print and exit
# non-zero). ship-ios.sh does.

# read_build_number <tauri.ios.conf.json> -> echoes bundle.iOS.bundleVersion (empty if unset)
read_build_number() {
  node -e '
    const config = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    process.stdout.write(String(config.bundle?.iOS?.bundleVersion ?? ""));
  ' "$1"
}

# read_marketing_version <package.json> -> echoes the app version
read_marketing_version() {
  node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).version)' "$1"
}

# bump_build_number <tauri.ios.conf.json> <new-build-number>
#
# Enforces monotonicity, writes the file (2-space JSON, trailing newline, as committed), and
# reads it back to prove the edit landed.
bump_build_number() {
  local config_path="$1"
  local new_build_number="$2"

  [[ -f "$config_path" ]] || fail "version bump (config not found at $config_path)"

  local current_build_number
  current_build_number="$(read_build_number "$config_path")"
  if ! [[ "$current_build_number" =~ ^[0-9]+$ ]]; then
    fail "version bump (bundle.iOS.bundleVersion in $config_path is '$current_build_number', expected an integer)"
  fi

  # CFBundleVersion must be strictly monotonic: Apple rejects a repeated or lower build number
  # at the altool stage (ITMS-90189), long after archive and export have both reported success.
  if [[ "$new_build_number" -le "$current_build_number" ]]; then
    echo "Error: build number must increase. tauri.ios.conf.json is at"
    echo "       $current_build_number, asked to ship $new_build_number."
    echo "       Apple rejects duplicate/declining build numbers (ITMS-90189)."
    fail "version bump (non-monotonic build number)"
  fi

  node -e '
    const fs = require("fs");
    const [path, buildNumber] = process.argv.slice(1);
    const config = JSON.parse(fs.readFileSync(path, "utf8"));
    config.bundle.iOS.bundleVersion = buildNumber;
    fs.writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
  ' "$config_path" "$new_build_number"

  local verified_build_number
  verified_build_number="$(read_build_number "$config_path")"
  if [[ "$verified_build_number" != "$new_build_number" ]]; then
    fail "version bump (expected bundleVersion=$new_build_number after the write, found '$verified_build_number')"
  fi
  echo "Bumped bundle.iOS.bundleVersion: $current_build_number → $new_build_number (in tauri.ios.conf.json)"
}
