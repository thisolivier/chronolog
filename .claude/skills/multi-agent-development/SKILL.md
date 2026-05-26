---
name: multi-agent-development
description: Orchestrate multi-agent software development with a Director/Team PM sprint system. Use when the user wants to parallelize development across multiple Claude sessions, set up sprint-based workflows, manage backlogs across teams, or coordinate multi-agent code delivery. Triggers on "multi-agent", "director", "team PM", "sprint planning", "parallelize development".
---

# Multi-Agent Development

A sprint-based orchestration pattern for parallelizing software development across multiple Claude Code sessions. One **Director** plans and integrates work; multiple **Team PMs** execute sprint tasks via sub-agents.

## When to use

- Project has multiple independent modules that can be developed in parallel
- Backlog has clear dependency ordering between work items
- User wants to maximize throughput by running multiple Claude sessions

## Architecture

```
Director (current Claude session, loops)
├── Team PM: Alpha (tmux window, 1 session per sprint)
│   ├── Sub-agent: implement module
│   ├── Sub-agent: write tests
│   └── Sub-agent: run tests
├── Team PM: Beta (tmux window, 1 session per sprint)
│   └── ...
└── Team PM: Gamma (tmux window, 1 session per sprint)
    └── ...
```

**Director** — the current Claude session. Plans sprints, reviews/merges completed work, manages contracts, unblocks teams. Only agent that merges to main. Only agent that loops. Dispatches to PMs via `tmux send-keys`.

**Team PM** — runs in a dedicated tmux window. Executes one sprint assignment, coordinates sub-agents, signs off, then stops. Never merges to main. Never plans sprints.

**Sub-agents** — do the actual code/test work inside git worktrees. Launched by Team PMs.

## Sprint cycle

```
Director writes sprint spec (status: active)
    → Team PM reads spec, creates worktree, executes via sub-agents
    → Team PM signs off (status: signed-off)
    → Director reviews, runs tests, merges (status: merged)
    → Director writes next sprint specs
    → Repeat
```

The Director polls sprint docs for sign-offs (cron every 3 minutes). PMs do NOT notify the Director — the Director discovers completed work by reading sprint docs on main.

## File templates

- [init.md](init.md) — First-time project setup (directory structure, teams, backlogs, prompts)
- [director-template.md](director-template.md) — Director prompt template
- [team-pm-template.md](team-pm-template.md) — Team PM prompt template
- [team-pm-qa-template.md](team-pm-qa-template.md) — QA PM prompt template (cross-team tester)
- [qa-sprints.md](qa-sprints.md) — QA sprint planning and the QA → Fix cycle
- [sprint-template.md](sprint-template.md) — Sprint spec template
- [dispatch.md](dispatch.md) — tmux dispatch protocol
