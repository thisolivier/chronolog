# launchd — nightly Chronolog database backup

`com.olivier.chronolog-db-backup.plist` is a **user LaunchAgent** (not a root LaunchDaemon) that runs
`backup-postgres.sh` every day at **03:30** local time. It mirrors the musicLibrary precedent
(`com.olivier.musiclibrary-db-backup`, 04:00): the job runs a copy of the script installed under
`~/Backups/chronolog/bin/`, so it never depends on the state of a git checkout or worktree.

| Path | What |
|---|---|
| `~/Backups/chronolog/bin/backup-postgres.sh` | installed copy of `scripts/backup-postgres.sh` |
| `~/Backups/chronolog/daily/`, `weekly/` | dumps: 14 daily, 8 weekly (Sunday UTC promotion) |
| `~/Backups/chronolog/logs/backup-YYYY-MM.log` | script log (UTC timestamps) |
| `~/Backups/chronolog/logs/launchd-std{out,err}.log` | launchd capture |
| `/Volumes/Rabbit4TB/Backups/chronolog/` | mirror, only when the volume is mounted |

If a 03:30 run is missed because the Mac was asleep, launchd runs it at the next wake.

## Install

```bash
mkdir -p ~/Backups/chronolog/bin ~/Backups/chronolog/logs
install -m 755 scripts/backup-postgres.sh ~/Backups/chronolog/bin/backup-postgres.sh
cp scripts/launchd/com.olivier.chronolog-db-backup.plist ~/Library/LaunchAgents/
plutil -lint ~/Library/LaunchAgents/com.olivier.chronolog-db-backup.plist
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.olivier.chronolog-db-backup.plist
launchctl kickstart -k gui/$UID/com.olivier.chronolog-db-backup   # run once now
launchctl print gui/$UID/com.olivier.chronolog-db-backup | grep -E 'state|last exit'
```

Re-run the `install -m 755` line whenever `scripts/backup-postgres.sh` changes.

If the mirror step logs `Operation not permitted` on `/Volumes/Rabbit4TB`, grant `/bin/bash` Full
Disk Access in System Settings (owner at the keyboard), as for the musicLibrary job.

## Uninstall

```bash
launchctl bootout gui/$UID/com.olivier.chronolog-db-backup
rm ~/Library/LaunchAgents/com.olivier.chronolog-db-backup.plist
# Dumps and logs under ~/Backups/chronolog are left in place on purpose.
```
