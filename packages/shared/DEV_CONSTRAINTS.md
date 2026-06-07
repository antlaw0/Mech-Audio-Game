# Shared Core Infrastructure Edit Constraints

Scope: core infrastructure files such as trace, system-map, and state core utilities.

## Required Rules

1. Never replace core infrastructure files wholesale during edits unless explicitly requested by the user.
2. Apply changes as incremental diffs only.
3. Restrict edits to function-level changes only.
4. If patch corruption is detected, attempt a minimal surgical fix first.
5. If patch corruption is detected, do not delete and recreate the file.

## Governance Intent

These constraints are development governance rules for editing behavior only.
They do not add or modify runtime functionality.
