---
name: accommodation-tracker
description: Track unexpected workarounds, architectural accommodations, and repeated failed attempts (guttering) during implementation. Use after completing a major implementation stage, when the user asks to review accommodations, or when pattern-validator flags a CAUTION or RED FLAG. Also use when the user says "track accommodations", "what workarounds did we make", or "review deviations".
---

# Accommodation Tracker

Track and document unexpected workarounds, architectural changes, repeated failed attempts (guttering), and deviations from the original plan that accumulate during implementation work. This skill operates in two modes: **on-the-fly guttering detection** during implementation, and **post-stage audit** at stage boundaries.

## When to use this skill

### Post-stage audit (invoke explicitly)

Use this skill **after each major implementation stage** to audit what changed unexpectedly. Also invoke when:
- The pattern-validator skill flags something as CAUTION or RED FLAG
- The user asks to review what workarounds were made
- You notice the implementation has drifted significantly from the original plan
- A task required 3+ unexpected changes to make something work

### Guttering detection (self-monitor continuously)

During implementation, watch for these signals that indicate you are stuck in a loop:

- **Repeated edits**: 3+ edits to the same file/function targeting the same issue without resolving it
- **Recurring errors**: searching for or encountering the same error message 3+ times
- **Revert cycles**: reverting a change and trying a variation of the same approach
- **Dependency churn**: adding, removing, or swapping the same dependency or config value

When you detect guttering:

1. **Stop** implementation of the current approach
2. **Record** the guttering event in the accommodations file as an in-progress item using this format:
   ```markdown
   ## N. [GUTTERING] Short description of what you're stuck on

   **Status**: In progress — not yet resolved
   **Attempts**: [number of attempts so far]
   **Approach tried**: [brief description of what you've been repeating]
   ```
3. **Surface it to the user**: "I've made N attempts at [X] without success. Before trying again, I'd suggest: (a) validate the underlying assumption with `/pattern-validator`, (b) try a fundamentally different approach, or (c) continue iterating. What would you prefer?"
4. **Wait** for user direction before continuing
5. If eventually resolved, update the guttering entry to a full accommodation entry with what finally worked

## Instructions

### Step 1: Identify the accommodations file

Check if an accommodations file already exists for the current task using Glob:

```
pattern: "docs/*accommodations*" (case-insensitive)
```

Also check for a task-specific file based on the current branch name or task context.

If no file exists yet and there are accommodations to track, create one at `docs/<TASK_NAME>_ACCOMMODATIONS.md`.

### Step 2: Inventory unexpected changes

Review the current session and recent commits for changes that were NOT part of the original plan. Look for:

- **Schema changes** required by a library or service limitation
- **Infrastructure changes** (new services, config changes, port changes)
- **Workarounds** for bugs or missing features in dependencies
- **Architectural deviations** from the spec or original design
- **New dependencies** added to solve unexpected problems
- **Configuration that differs** from what documentation suggested

For each accommodation, determine:
- **What changed** and why
- **Impact level**: Low / Medium / High
- **Effort**: Low / Medium / High
- **Reversible?**: Yes (how) / No (why) / N/A
- **Was it validated?**: Did we check if this is a normal pattern? (link to pattern-validator finding if applicable)

### Step 3: Classify severity

Rate each accommodation:

| Severity | Meaning |
|----------|---------|
| **Low** | Minor config tweak, no architectural impact |
| **Medium** | Meaningful change but well-understood trade-off |
| **High** | Significant architectural deviation, affects future work |

### Step 4: Write or update the accommodations file

Use this format for each entry:

```markdown
## N. Short Title

**Impact**: [description]
**Effort**: Low / Medium / High

[2-3 sentences explaining what changed and why]

**What changed**:
- [bullet list of concrete changes]

**Trade-off**: [what we gained vs what we gave up]
```

End the file with a summary table:

```markdown
## Summary

| Accommodation | Severity | Reversible? |
|---|---|---|
| [title] | [severity] | [yes/no/n/a] |
```

### Step 5: Flag items needing community validation

If any accommodation has NOT been validated against community patterns, flag it:

```markdown
> **Needs validation**: This accommodation has not been checked against community patterns. Run `/pattern-validator [description]` to verify.
```

## Integration with pattern-validator

When the pattern-validator skill flags a CAUTION or RED FLAG:
1. Open or create the accommodations file for the current task
2. Add an entry documenting the finding
3. Include the pattern-validator's verdict and research summary
4. Mark it as validated (since pattern-validator already did the research)

Guttering events may also trigger pattern-validator. When you surface a guttering event to the user and they choose option (a) — validate the underlying assumption — invoke `/pattern-validator` with a description of the assumption you've been working under.

## Output

After running the post-stage audit, present a brief summary to the user:
- Total accommodations tracked (including any resolved guttering events)
- Breakdown by severity (Low/Medium/High)
- Any items flagged for validation
- Any unresolved guttering events still in progress
- Link to the accommodations file
