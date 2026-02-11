---
name: accommodation-tracker
description: Track unexpected architectural accommodations during complex multi-stage migrations or integrations. Use proactively when work involves integrating third-party systems, migrating between technologies, or any multi-phase task where unexpected workarounds may accumulate. Also use when the user says "track accommodations", "check for red flags", or "migration report".
user-invocable: true
argument-hint: [task-description]
---

# Accommodation Tracker

Track, research, and validate unexpected architectural accommodations during complex multi-stage work (migrations, integrations, major refactors). Accommodations are changes you didn't plan for — workarounds, schema changes, infrastructure adjustments, or architectural compromises forced by external constraints.

## Why This Matters

Accommodations accumulate silently during complex work. Each one seems reasonable in isolation, but together they can signal that a chosen approach is fundamentally misaligned. Systematic tracking + periodic research catches problems early — before you've invested too much to change course.

## When to Use This Skill

Use **proactively** whenever:
- Migrating between technologies (e.g., custom sync to PowerSync)
- Integrating a third-party system that touches your schema or architecture
- Working on any multi-phase task spanning multiple sessions
- You encounter something unexpected that requires changing your plan

Use **on demand** when:
- The user asks to track accommodations or check for red flags
- You want to validate whether accumulated workarounds are normal

## Instructions

### Step 1: Initialize the Accommodations File

At the start of complex multi-stage work, create or locate the accommodations file.

**Convention**: `docs/<TASK_NAME>_ACCOMMODATIONS.md`

If the file doesn't exist, create it from the template in `templates/accommodations.md` in this skill directory. If a task description is provided via `$ARGUMENTS`, use it to set the document title.

### Step 2: Track Accommodations as They Arise

Every time you encounter an unexpected accommodation during implementation, **immediately** add it to the file with:

- **Number and title** (sequential)
- **Impact**: How much it affects the architecture (Low / Medium / High)
- **Effort**: How much work it required (Low / Medium / High)
- **What happened**: What you expected vs what you had to do instead
- **What changed**: Specific files and code affected
- **Trade-off**: What you gained vs what you gave up

Use this severity rubric:
- **Low**: Cosmetic or one-time configuration (e.g., type conversion helpers, env var setup)
- **Medium**: Infrastructure change that's reversible (e.g., Docker config, new auth endpoints)
- **High**: Schema change, data model change, or architectural constraint that affects future work

### Step 3: Research After Each Major Stage

After completing each major phase/stage of work, do the following:

1. **Identify new accommodations** added since the last research check
2. **Launch a research sub-agent** to search online for each new accommodation:
   - Is this a normal/expected pattern in the community?
   - Are there documented alternatives?
   - Do community discussions flag any long-term concerns?
   - Are there open issues or roadmap items addressing the root cause?
3. **Rate each accommodation**:
   - **NORMAL**: Community-validated pattern, proceed without concern
   - **CAUTION**: Has trade-offs but manageable, document mitigation
   - **RED FLAG**: Community warns against this, or signals fundamental misalignment
4. **Update the accommodations file** with research findings
5. **Add a research timestamp** so future checks know what's been validated

### Step 4: Red Flag Gate

**If any HIGH severity accommodation is rated RED FLAG:**

1. **STOP implementation work immediately**
2. Report the finding to the user with:
   - What the accommodation is
   - Why it's a red flag (community evidence)
   - What alternatives exist
   - Whether the overall approach should be reconsidered
3. **Do not proceed** until the user explicitly approves continuing

**If accommodations are NORMAL or CAUTION**: Continue to the next phase.

### Step 5: Final Summary

When the multi-stage work is complete, update the accommodations file with:
- Summary table of all accommodations with severity and research status
- Overall assessment: was the migration/integration approach sound?
- Any accommodations that should be revisited later (e.g., when upstream fixes ship)

## Research Prompt Template

When launching a research sub-agent for accommodation validation, use this structure:

```
Research the following accommodation made during [TASK DESCRIPTION]:

**Accommodation**: [TITLE]
**Severity**: [Low/Medium/High]
**Context**: [What we had to do and why]

Questions:
1. Is this a normal/expected pattern in the [TECHNOLOGY] community?
2. Are there documented alternatives?
3. Do community discussions or GitHub issues flag concerns?
4. Is the root cause on the vendor's roadmap to fix?

Search for: [TECHNOLOGY] + [ACCOMMODATION KEYWORDS]
Check: official docs, GitHub issues, Stack Overflow, blog posts, Discord/forum discussions
```

## Integration with PM Workflow

When acting as PM (delegating to sub-agents):
- Sub-agents should report any unexpected workarounds back to the PM context
- The PM should add these to the accommodations file
- Research checks happen at the PM level, not within sub-agents
- Sub-agents should use Context7 for library documentation lookups
