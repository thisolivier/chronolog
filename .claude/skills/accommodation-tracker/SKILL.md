---
name: accommodation-tracker
description: Track unexpected workarounds, architectural accommodations, and deviations from the original plan during implementation. Use after completing a major implementation stage, when the user asks to review accommodations, or when pattern-validator flags a CAUTION or RED FLAG. Also use when the user says "track accommodations", "what workarounds did we make", or "review deviations".
---

# Accommodation Tracker

Track and document unexpected workarounds, architectural changes, and deviations from the original plan that accumulate during implementation work.

## When to use this skill

Use this skill **after each major implementation stage** to audit what changed unexpectedly. Also invoke when:
- The pattern-validator skill flags something as CAUTION or RED FLAG
- The user asks to review what workarounds were made
- You notice the implementation has drifted significantly from the original plan
- A task required 3+ unexpected changes to make something work

## Instructions

### Step 1: Identify the accommodations file

Check if an accommodations file already exists for the current task:

```bash
find docs/ -name '*ACCOMMODATIONS*' -o -name '*accommodations*' 2>/dev/null
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

## Output

After running, present a brief summary to the user:
- Total accommodations tracked
- Breakdown by severity (Low/Medium/High)
- Any items flagged for validation
- Link to the accommodations file
