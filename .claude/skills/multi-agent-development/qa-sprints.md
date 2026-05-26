# QA Sprints

QA sprints are run by a dedicated **QA PM** — a cross-team tester who discovers issues but doesn't fix them. See [team-pm-qa-template.md](team-pm-qa-template.md) for the QA PM prompt.

## When to schedule QA

QA sprints belong at **deliverable milestones** — when team PMs have shipped meaningful new functionality that's worth testing as a whole. Signals:

- A feature is end-to-end complete across teams (e.g., server endpoint + client UI both merged)
- Multiple sprints have landed since the last QA round
- The project is approaching a release or demo
- End of a work session or overnight — good times to let QA run longer

Don't schedule QA after every small sprint. Wait until there's enough new surface area to justify it.

## The QA → Fix cycle

The Director orchestrates the cycle between the QA PM and team PMs:

```
1. Director dispatches QA sprint to QA PM
2. QA PM runs QA loop (discover → triage → document), signs off with pain points doc
3. Director reviews pain points, writes fix sprints for team PMs
4. Team PMs fix, sign off
5. Director merges fixes, dispatches next QA round to QA PM
6. QA PM re-verifies fixes + tests new scope
7. Director decides when to exit the cycle (diminishing returns, all L/M fixed, time constraint)
```

Multiple rounds can happen within a single session. The Director makes the call on when to move on — typically when all L and M issues are resolved and remaining items are cosmetic.

## Production safety

The Director is responsible for ensuring QA never touches production data. Before dispatching a QA sprint, spawn a **sonnet sub-agent** to verify:

- The sprint spec provides explicit QA config (ports, users, env vars) for every component — nothing defaults to prod
- The architecture supports QA instances alongside prod (no hardcoded ports, singleton locks, or shared state)
- Flag any gaps so the Director can fix the spec or file a pain point for team PMs

If the QA PM reports a blocker due to missing QA environment, unblock them — don't let them fall back to prod.

## QA sprint spec

QA sprints use the standard sprint template but with QA-specific fields:

- **Scope:** which features/workflows to exercise
- **Previous pain points:** path to carry-forward doc (if not round 1)
- **Components to test:** list of modules/services with their doc paths
- **Successful output handling:** for pipeline QA — graduate, hold, or discard

The QA PM's deliverable is always `docs/qa/pain-points.md`, not code.
