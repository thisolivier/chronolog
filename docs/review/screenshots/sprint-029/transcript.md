# Sprint 029 CLI transcript

Run against the worktree dev server (`http://localhost:5207`) as a fresh `qa-029-shots-*` user, with a token created in that session (its value is not shown). Screenshots: `01`/`02` first-run notice on the timesheet and notes list, `03-cli-log-before-edit.png`, `04-cli-edit-in-ui.png` (the edited entry in the timesheet), `05-after-undo.png`.

```
$ chronolog log "internal general" 45m "Drafted the proposal"
Logged 45m on 2026-11-03 to INTL/General: Drafted the proposal
id=74c1f50b-a9a0-4112-807e-755421e10a18

$ chronolog edit 74c1f50b-a9a0-4112-807e-755421e10a18 --duration 9:00-10:30 --description "Drafted and sent the proposal"
Updated 1h30m (09:00-10:30) on 2026-11-03 INTL/General: Drafted and sent the proposal
id=74c1f50b-a9a0-4112-807e-755421e10a18

$ chronolog log "internal general" 15m "Logged by mistake"
Logged 15m on 2026-11-03 to INTL/General: Logged by mistake
id=e6756d0e-ef61-4ada-bedb-056dc4943537

$ chronolog undo
Deleted 15m on 2026-11-03 to INTL/General: Logged by mistake
id=e6756d0e-ef61-4ada-bedb-056dc4943537

$ chronolog undo
chronolog: Nothing to undo: this CLI has no record of a logged entry (only `chronolog log` is undoable).
(exit 2)

```
