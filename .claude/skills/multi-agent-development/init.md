# Multi-Agent Development — First-Time Setup

How to scaffold multi-agent development on a new project.

## Phase 1: Initialize project structure

Create these directories and files in the project:

```
docs/
├── backlog.md              # Master backlog with build order
├── backlog-{team-id}.md    # Per-team backlog
├── contracts/              # Shared interface contracts
│   └── ...
├── sprints/
│   └── readme.md           # Sprint index
│   └── sprint-NNN-XX.md    # Sprint specs
prompts/
├── director.md             # Director prompt (from template)
├── team-pm.md              # Team PM template
├── team-pm-{ID}.md         # Per-team PM prompts
working-trees/              # Git worktrees for sprint branches
```

## Phase 2: Define teams

Each team needs:
- A short **ID** (2 letters, e.g., `OR`, `DA`, `DW`, `RV`)
- A **name** (e.g., "Orchestration & Infrastructure")
- A **backlog file** with ordered work items prefixed by team ID (e.g., `OR-1`, `OR-2`)
- A **prompt file** generated from the team PM template

## Phase 3: Write the master backlog

`docs/backlog.md` must define:
- All teams and their backlog files
- The **MVP build order** — which items must complete before others can start
- Dependency graph between teams (e.g., "OR-1 unblocks all teams")

## Phase 4: Generate prompts

Use the templates in [director-template.md](director-template.md) and [team-pm-template.md](team-pm-template.md) to generate project-specific prompts. Replace all `{VARIABLES}` with project values.
