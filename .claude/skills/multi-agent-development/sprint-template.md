# Sprint Spec Template

Use this template when creating new sprint documents in `docs/sprints/`.

---

## Standard Sprint (Code Delivery)

```markdown
# Sprint {NNN} — {TEAM_ID}: {Short Title}

**Status:** active
**Type:** standard
**Backlog items:** {e.g., OR-1, OR-2}
**Depends on:** {any prior sprints or branches that must be merged first}
**Branch:** (to be filled by Team PM)
**Working tree:** (to be filled by Team PM)

## Objectives

{1-3 sentences: what this sprint delivers and why it matters.}

## Tasks

{Ordered list. Each task should be a clear deliverable, not an implementation step.
Be functional (what), not prescriptive (how).}

1. {Task description}
2. {Task description}
3. ...

## Contracts

{Which shared contracts apply. Point to specific files.}

- Schema: `docs/contracts/schema.sql` — tables X, Y
- Config: `docs/contracts/config.md` — keys A, B
- Interface: `docs/contracts/worker-interface.md` — methods X, Y

## Verification

{How to verify the sprint works. Include exact commands.}

- Test command: `{exact test command, e.g. python -m pytest tests/ -v}`
- Live E2E check: `{curl command or manual step to verify in running environment}`

## Acceptance Criteria

{How the Director will verify this sprint is complete. Be specific and testable.}

- [ ] `pytest path/to/tests/` passes — including all new tests
- [ ] {Specific behavioral criterion}
- [ ] {Specific behavioral criterion}
- [ ] No files over 200 lines
- [ ] `module/readme.md` updated

## Post-QA Checklist

{After a QA cycle completes, the Director should:}
1. Merge bug fixes to main
2. Rebuild affected services if applicable
3. Ship build if applicable
4. Update sprint state

## QA Teardown

{At the end of a QA sprint, the QA PM should:}
1. Restore any modified config to default settings
2. Clean up QA artifacts and test data
3. Terminate any running test processes
4. Answer in sign-off: "Would an isolated test environment have been helpful this sprint?"

## Notes

{Director: add cross-team context here when dispatching. Reference specific doc paths and
sections the PM will need.}

{Director: AUDIT SCOPE — when a bug fix touches a pattern that exists in multiple places
(e.g., filename serialization), the spec MUST say "audit all instances" rather than
"fix this one endpoint." Grep the codebase for all occurrences.}

{Director: BUG CLASS — when filing or fixing a bug, check: "Is this a new bug class or a
new instance of an existing class?" If it's a known class, reference the prior instances
and require a systemic fix, not a point fix.}

(Team PM: write progress notes here. If you hit a blocker from another team, document it —
what you need, from whom, and what you were able to complete without it. Continue with
everything you can do independently.)

## Sign-off

(Team PM fills this when done)
```

---

## Discovery Sprint (Spec Delivery)

```markdown
# Sprint {NNN} — {TEAM_ID}: {Short Title}

**Status:** active
**Type:** discovery
**Backlog items:** {e.g., PL-1}
**Depends on:** {any prior sprints that must complete first}

## Objectives

{1-3 sentences: what this sprint discovers/defines and why it matters.}

## Scope

{What domain or questions this discovery covers. Be specific about boundaries.}

## User Dialogue

{yes/no — does this sprint require conversation with the user?}
{If yes, describe what the PM should explore with the user.}

## Deliverable

{Path and description of the spec document to produce.}

- Path: `docs/{filename}.md`
- Contents: {What the document must cover}
- Format: {Any structural requirements}

## Acceptance Criteria

{How the Director will verify the spec is complete.}

- [ ] Deliverable document exists at specified path
- [ ] {Specific content requirement}
- [ ] {Specific content requirement}
- [ ] Key decisions documented with rationale
- [ ] Blockers and dependencies identified

## Notes

{Director: add cross-team context here when dispatching. Reference specific doc paths and
sections the PM will need.}

(Team PM: write progress notes here. If you hit a blocker from another team, document it —
what you need, from whom, and what you were able to complete without it. Continue with
everything you can do independently.)

## Sign-off

(Team PM fills this when done — see team-pm-template.md for discovery sign-off format)
```

---

## Sprint status lifecycle

```
active        — Sprint spec written, ready for Team PM to pick up
signed-off    — Team PM completed work and signed off
merged        — Director reviewed, tests passed, branch merged to main (standard only)
accepted      — Director reviewed and accepted deliverable (discovery only)
closed        — Sprint abandoned or superseded (explain in Notes)
```

## Numbering convention

- Sprint numbers are globally sequential across all teams: `001`, `002`, `003`, ...
- The team ID suffix disambiguates: `sprint-003-OR.md`, `sprint-003-DA.md`
- Multiple teams can have the same sprint number if their sprints are concurrent
