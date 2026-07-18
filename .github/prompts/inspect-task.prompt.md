---
agent: "agent"
description: "Inspect a Mech Audio Game task before making any edits"
---

Inspect the requested task without editing files.

Read:

- `SESSION_NOTES.md`
- `AI_CONTEXT.md`
- `docs/CURRENT_STATE.md`
- The relevant item in `docs/ROADMAP.md`
- The likely source files

Return this structure:

## Outcome

State the exact observable outcome.

## Source of truth

Identify the authoritative store, resolver, data file, system, or event path.

## Current flow

Explain the current ownership and data flow from input through state to output.

## Required files

List only files that appear necessary.

## Existing helpers

List reusable APIs or modules.

## Risks

List likely regressions, including keyboard focus, audio, persistence, combat, and runtime orchestration where relevant.

## Minimal implementation

Describe the smallest behavior-preserving approach.

## Acceptance criteria

Turn the task into testable statements.

## Verification

List automated commands and exact manual playtest steps.

Do not edit. Do not propose broad cleanup. Do not invent missing gameplay rules.
