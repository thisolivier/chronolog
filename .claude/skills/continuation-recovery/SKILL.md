---
name: continuation-recovery
description: Recover context at session continuations using targeted episodic memory searches. Auto-triggered when Claude detects a continuation summary, references to prior work not in context, or the user saying "continue where we left off". Covers session continuation, context recovery, episodic memory.
user-invocable: false
---

# Continuation Recovery

Recover key decisions, gotchas, and preferences from prior sessions WITHOUT flooding the context window. This skill is auto-triggered -- the user does not invoke it.

## When to Trigger

Activate when ANY of these signals are present:
- A conversation summary block mentioning "continued from a previous conversation"
- User says "continue", "pick up where we left off", or similar
- References to completed work that is not visible in the current context
- The conversation starts with a task context but no visible history

## Instructions

### 1. Gather search terms (do not search yet)

From the continuation summary and environment, collect:
- **Project name**: from the working directory path (e.g., "chronolog")
- **Branch name**: from `git branch --show-current`
- **Task keywords**: 2-3 specific nouns from the summary (e.g., "offline sync", "conflict resolution")

### 2. Run ONE targeted episodic memory search

Use the `mcp__plugin_episodic-memory_episodic-memory__search` tool with:
- `query`: an array of 2-4 specific terms (project name + branch or task keywords)
- `limit`: 10
- `mode`: "both"

Example:
```
query: ["chronolog", "offline-sync", "conflict resolution"]
limit: 10
```

Do NOT run multiple searches. One precise search beats three broad ones.

### 3. Extract only actionable items

From the search results, extract ONLY:
- **Decisions**: what was chosen and why (1 line each)
- **Gotchas**: errors hit and their fixes (1 line each)
- **Preferences**: user conventions or stated preferences (1 line each)

IGNORE: code snippets, exploratory discussion, verbose explanations, anything already in CLAUDE.md or MEMORY.md.

### 4. Update working memory

If findings contain information NOT already in the project's `MEMORY.md`, append a brief section:
```
## Session Recovery [date]
- Decision: [what] because [why]
- Gotcha: [problem] -- fix: [solution]
```

Keep additions under 10 lines. If everything is already captured, do not write anything.

### 5. Resume work

Summarize recovered context to the user in 2-3 sentences, then proceed with their request. Do not recite the full memory contents.
