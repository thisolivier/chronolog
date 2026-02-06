# Claude Configuration for LED Lights Monorepo

## Working Trees

When asked to work in a new git working tree:
1. Create the working tree inside the `working-trees/` directory at the repository root
2. Each working tree directory should be locked to a single Claude session at a time
3. Before using a working tree, check if it's already in use by another session
4. Use a lock file (e.g., `.claude-session.lock`) in the working tree to indicate active use
5. Release the lock when the session ends or when switching away from that working tree

## Agent Directives

### General (All Packages)
- Start each response with ☀️
- Read 'readme.md' files for the module you are working with
- Keep code readable by verbose variable names - never abbreviate to a single letter
- Keep dependencies minimal
- Prefer simple low-code solutions to complex ones where possible
- Pro-actively modularize the code
  - Split groups of functions into separate files with clean interfaces
  - Prefer file lengths of less than 200 lines (light preference)
  - Add readme.md files at the root of each module to describe the architecture and subcomponents
  - Ensure readme files are updated at the end of each task

Your work is deeply appreciated.

### Paths Not to Modify
Do not modify files managed by package managers.