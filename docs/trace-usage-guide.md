# Trace Usage Guide

This guide defines lightweight, repeatable workflows for using the Mech Audio Game trace system during debugging.

Scope:
- Developer debugging only
- Read-only trace analysis
- No gameplay/runtime integration changes

Trace separation rules:
- The trace system is immutable and represents raw facts only.
- `trace-narrative` is a derived interpretation layer only.
- `trace-narrative` must not modify, enrich, or rewrite trace events.
- `trace-narrative` must not feed data back into `trace.emit` or any runtime system.
- Use raw trace queries as input only; all narrative output is post-hoc projection.

Assumed APIs:
- `getTraceEvents(filter)`
- `getLatestTraceEvents(n)`
- `getCriticalEventsOnly()`

Related domains currently instrumented at system boundaries:
- `movement`
- `combat`
- `audio-system`
- `inventory`
- `ai-decision-loops`
- `scene-transitions`

Common boundary events:
- `enter`
- `exit`

## Quick Start

```ts
import {
  getTraceEvents,
  getLatestTraceEvents,
  getCriticalEventsOnly,
  type TraceEvent
} from '@mech-audio/shared'
```

```ts
const recent = getLatestTraceEvents(150)
const movementOnly = getTraceEvents({ domain: 'movement' })
const combatEnters = getTraceEvents({ domain: 'combat', event: 'enter' })
const critical = getCriticalEventsOnly()
```

## Workflow: Debug Movement Issues

Use when the player seems to stutter, overshoot, or diverge from expected movement flow.

1. Pull recent movement boundary events.
2. Verify every `movement.enter` has a matching `movement.exit`.
3. Compare payload position progression between exits.
4. Correlate with `scene-transitions` for chunk/visibility side effects.

```ts
const movementEvents = getTraceEvents({ domain: 'movement' })

const movementBoundaryPairs = movementEvents.filter(
  (e) => e.event === 'enter' || e.event === 'exit'
)

const transitionEvents = getTraceEvents({ domain: 'scene-transitions' })
```

What to look for:
- Missing `movement.exit` after `movement.enter`
- Unexpected large deltas in `playerX/playerY/playerZ`
- Movement anomalies that line up with heavy transition windows

## Workflow: Debug Combat Issues

Use when damage application, projectile outcomes, or hit resolution feels wrong.

1. Pull combat boundary events.
2. Confirm `combat.enter` and `combat.exit` cadence over recent frames.
3. Inspect payload entity counts at `combat.exit`.
4. Cross-check with AI loop boundaries to confirm combat stepping cadence.

```ts
const combatEvents = getTraceEvents({ domain: 'combat' })
const aiEvents = getTraceEvents({ domain: 'ai-decision-loops' })

const combatExits = combatEvents.filter((e) => e.event === 'exit')
const latestCombatExits = combatExits.slice(-20)
```

What to look for:
- Inconsistent or missing combat boundary pairs
- Entity count spikes/drops at `combat.exit`
- Combat cadence drift relative to AI loop cadence

## Workflow: Trace AI Decision Chains

Use when AI appears delayed, inconsistent, or behaviorally incorrect.

1. Pull AI domain events.
2. Build ordered `enter -> exit` chain per recent window.
3. Correlate AI boundaries with combat boundaries in the same window.
4. Inspect cadence-related payload fields.

```ts
const aiChain = getTraceEvents({ domain: 'ai-decision-loops' })
  .filter((e) => e.event === 'enter' || e.event === 'exit')

const recentWindow = getLatestTraceEvents(250)
const aiAndCombat = recentWindow.filter(
  (e) => e.domain === 'ai-decision-loops' || e.domain === 'combat'
)
```

What to look for:
- Gaps where AI `enter` has no corresponding `exit`
- Large intervals between AI cycles during active combat
- Combat running without expected AI decision boundary activity

## Workflow: Isolate Critical Event Sequences

Use when reproducing severe failures, stalls, or catastrophic state transitions.

1. Pull critical events first.
2. For each critical event, capture nearby context from latest event window.
3. Reconstruct chain by domain/event around the critical marker.

```ts
const criticalEvents = getCriticalEventsOnly()

const contextWindow = getLatestTraceEvents(400)
const criticalWithContext = criticalEvents.map((critical) => ({
  critical,
  context: contextWindow.filter((e) =>
    new Date(e.timestamp).getTime() <= new Date(critical.timestamp).getTime()
  ).slice(-40)
}))
```

What to look for:
- Repeating precursor domains before critical points
- Missing expected `exit` events before critical escalation
- Cross-domain ordering problems before failure

## Standard Debugging Patterns

### 1) Last Decision Chain

Goal: answer "what decisions happened right before behavior changed?"

```ts
const chain = getLatestTraceEvents(120)
  .filter((e) => e.domain === 'ai-decision-loops' || e.domain === 'combat')
```

Use this to inspect the most recent AI/combat decision envelope.

### 2) System Flow Reconstruction

Goal: rebuild high-level frame/system order.

```ts
const flow = getLatestTraceEvents(250)
  .filter((e) =>
    e.domain === 'movement'
    || e.domain === 'combat'
    || e.domain === 'audio-system'
    || e.domain === 'inventory'
    || e.domain === 'scene-transitions'
    || e.domain === 'ai-decision-loops'
  )
```

Then group by event pairings (`enter`/`exit`) to reconstruct subsystem flow.

### 3) Critical Event Backtrace

Goal: find immediate causes of critical outcomes.

```ts
const critical = getCriticalEventsOnly()
const timeline = getLatestTraceEvents(500)

const backtraces = critical.map((c) => ({
  critical: c,
  leadup: timeline
    .filter((e) => new Date(e.timestamp).getTime() <= new Date(c.timestamp).getTime())
    .slice(-60)
}))
```

### 4) State-Affecting Event Isolation

Goal: isolate events most likely to affect gameplay state transitions.

```ts
const stateAffecting = getTraceEvents()
  .filter((e) =>
    (e.domain === 'movement' && e.event === 'exit')
    || (e.domain === 'combat' && e.event === 'exit')
    || (e.domain === 'inventory' && e.event === 'exit')
    || (e.domain === 'scene-transitions' && e.event === 'exit')
  )
```

Use this as a reduced timeline when full trace history is too noisy.

### 5) Domain + Event Chain Filter

Goal: inspect exact chain segments by domain and event.

```ts
const enters = getTraceEvents({ event: 'enter' })
const movementEnters = getTraceEvents({ domain: 'movement', event: 'enter' })
const combatExits = getTraceEvents({ domain: 'combat', event: 'exit' })
```

This pattern is useful for pair-matching and cadence checks.

## Recommended Investigation Order

1. Start with `getCriticalEventsOnly()` if issue severity is high.
2. If no critical events, inspect `getLatestTraceEvents(n)` for broad context.
3. Narrow with `getTraceEvents({ domain, event })`.
4. Rebuild chain using one of the standard patterns above.
5. Record findings as: expected chain vs observed chain.

## Notes

- Missing `level` values should be interpreted as `info` by debugging convention.
- This guide intentionally avoids runtime behavior changes and focuses on post-hoc reasoning.
- When interpreting traces, treat raw events as the source of truth and narratives as projection only.
