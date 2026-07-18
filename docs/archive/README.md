# Archived Project Documentation

Documents in this directory are historical reference only.

They may contain:

- Obsolete architecture
- Completed implementation tickets
- Old Copilot prompts
- Superseded formulas
- Unverified implementation notes
- Earlier product direction
- Values that no longer match runtime configuration

## Authority

Archived documents do not override:

1. Current user instructions
2. `SESSION_NOTES.md`
3. `AI_CONTEXT.md`
4. `docs/CURRENT_STATE.md`
5. `docs/ROADMAP.md`
6. Current source code and authored data

## Naming

Use a descriptive name and archive date.

Examples:

```text
AI_CONTEXT-legacy-2026-07-18.md
ImplementationRoadMap-legacy-2026-07-18.md
pre-demo-doc-update-20260718-113000/
```

## Rules

- Do not edit archived documents to make them current.
- Do not direct AI to execute an archived ticket without first promoting it into the active roadmap or session notes.
- When an archived decision remains useful, restate the current version in the appropriate active document.
- Preserve archives for traceability, not authority.

The documentation-update installer creates a timestamped archive before replacing active files.
