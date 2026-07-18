---
applyTo: "**/*.ts,**/*.tsx,**/*.js,**/*.mjs"
---

# TypeScript and JavaScript Instructions

- Follow `AI_CONTEXT.md` and `.github/copilot-instructions.md`.
- Preserve existing module style and naming.
- Use explicit types for exported APIs.
- Prefer `unknown` over `any` at untrusted boundaries.
- Validate parsed JSON, network messages, storage values, and external inputs.
- Do not duplicate existing calculations in UI or orchestration code.
- Keep pure calculations separate from DOM, audio, storage, and network side effects.
- Avoid new global mutable state.
- Do not introduce a new manager, controller, or service unless the responsibility has independent state, lifecycle, testing value, or more than one public operation.
- Do not add an independent feature directly to `packages/client/src/test-map/main.ts` when a focused module is appropriate.
- Avoid circular imports.
- Avoid wildcard imports.
- Do not reformat unrelated code.

## Closing-brace comments

Every closing brace added or modified must have a trailing comment identifying what it closes.

Examples:

```ts
if (isReady) {
  startSystem()
} // end if isReady

for (const item of items) {
  processItem(item)
} // end for each item

const calculateTotal = (): number => {
  return values.reduce((total, value) => total + value, 0)
} // end function calculateTotal

class MissionManager {
  public update(): void {
    // Update mission state.
  } // end method update
} // end class MissionManager
```

For callbacks, use a concise description:

```ts
button.addEventListener('click', () => {
  activateFacility()
}) // end click listener
```

Do not place an uncommented `}` on a line when comments are syntactically legal.

## Errors and logging

- Use actionable error messages.
- Do not silently replace invalid authored values.
- Avoid permanent noisy per-frame logs.
- Route diagnostics through existing debug or trace systems where practical.

## Tests

- Pure gameplay calculations should have deterministic tests.
- Use a fixed seed for tests involving randomness.
- Test success, boundary, and failure cases.
- Do not make tests depend on timing or audio playback when a pure state test is possible.
