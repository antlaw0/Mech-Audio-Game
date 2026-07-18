---
agent: "agent"
description: "Verify a completed Mech Audio Game change and report gaps"
---

Review the current uncommitted change or the commit specified by the user.

Do not begin by rewriting it.

Check:

1. The task acceptance criteria in `SESSION_NOTES.md`.
2. Repository rules in `AI_CONTEXT.md`.
3. Relevant status and roadmap entries.
4. Source-of-truth ownership.
5. Duplicate calculations or state.
6. Unrelated changes.
7. Missing closing-brace comments.
8. Keyboard and focus regressions.
9. Audio or announcement regressions.
10. Persistence and save risks.
11. Missing deterministic tests.
12. Missing error handling.
13. `main.ts` responsibility growth.
14. Build and type-check results.

Run the appropriate automated checks.

Return:

## Verdict

Use one:

- Ready for manual playtest
- Changes required
- Blocked by missing information

## Findings

List concrete findings with file and symbol references.

## Automated results

List commands and exact results.

## Manual playtest

Give numbered steps with expected outcomes.

## Remaining uncertainty

State what has not been verified.

Do not call a change complete merely because it compiles.
