---

name: Mech Audio Game AI Execution Contract
description: Architecture preservation and implementation guardrails for Mech Audio Game
invokable: false
----------------

# Mech Audio Game AI Execution Contract

You are working in the Mech Audio Game codebase.

Your primary objective is to preserve architectural consistency while making the smallest possible change required to satisfy the request.

## Core Principle

Existing architecture is authoritative unless the user explicitly requests architectural changes.

Do not redesign systems.

Do not invent new architectures.

Do not move responsibilities between systems unless explicitly instructed.

When uncertain, stop and explain the uncertainty before making changes.

---

## Single Source Of Truth Rules

Resolvers are authoritative.

If a resolver exists for a value:

* Use the resolver.
* Extend the resolver if necessary.
* Consume resolver output.
* Do not duplicate resolver calculations elsewhere.

UI, overlays, telemetry, traces, debugging tools, inspectors, and developer consoles must consume authoritative outputs rather than recomputing values.

If duplicate calculations are discovered:

* Report them.
* Do not silently create additional copies.

---

## Calculation Rules

Never introduce a second calculation path for the same gameplay value.

Before adding a calculation:

1. Search for an existing implementation.
2. Determine whether it is authoritative.
3. Reuse it whenever possible.

Avoid:

* duplicated formulas
* duplicated state machines
* duplicated derived values
* duplicated threshold logic
* duplicated normalization logic

If multiple implementations already exist:

* identify the authoritative implementation
* report the duplication
* avoid introducing additional copies

---

## Editing Rules

Prefer modifying existing code over creating new code.

Prefer extending existing functions over introducing new systems.

Prefer patches over rewrites.

Prefer local changes over broad changes.

Do not perform unrelated cleanup.

Do not rename symbols unless explicitly requested.

Do not reformat large files unless explicitly requested.

Do not change behavior outside the requested scope.

---

## Architecture Preservation Rules

Do not create new manager classes, service layers, controllers, abstractions, frameworks, registries, factories, or helper systems unless explicitly requested.

Do not split files merely for organization.

Do not consolidate files merely for organization.

Do not relocate logic between modules unless explicitly requested.

Do not introduce patterns simply because they are considered best practice.

Respect the existing architecture.

---

## Debugging Rules

Runtime evidence is authoritative.

Prefer:

* trace output
* debug snapshots
* runtime inspection
* dump functions
* instrumentation data

Do not speculate about runtime behavior when evidence is available.

If evidence is missing:

* explain what evidence is required
* request that evidence

Do not guess.

---

## Trace System Rules

Trace output is a diagnostic tool and source of runtime evidence.

When trace data exists:

* trust observed runtime behavior
* do not override trace evidence with assumptions

If a bug report conflicts with trace output:

* investigate the discrepancy
* do not ignore the trace

---

## Resolver Rules

Resolvers should expose authoritative state.

Resolvers should separate:

* raw inputs
* derived values
* diagnostics

Consumers should read resolver outputs rather than recomputing values.

If a resolver is missing data required by consumers:

* extend the resolver
* do not create parallel calculations

---

## Scope Control Rules

Before editing:

Identify:

* files affected
* systems affected
* source of truth
* expected behavior

Keep edits as small as possible.

If the requested change would require modifying more than three major systems:

Stop.

Explain the proposed plan before editing.

---

## Response Requirements

Before making edits:

1. Identify authoritative source of truth.
2. Identify files that require modification.
3. Explain why those files need modification.
4. Describe the smallest viable implementation.

After edits:

1. Summarize changed files.
2. Summarize behavior changes.
3. List assumptions made.
4. List follow-up validation steps.

---

## Accessibility Rules

When generating code:

* Use descriptive naming.
* Avoid unnecessary nesting.
* Prefer clarity over cleverness.
* Keep logic easy to inspect with screen readers.
* Maintain consistent naming across files.

When modifying existing code:

* Preserve naming conventions already used by the project.

---

## Mission-Critical Rule

If a request can be satisfied by extending an existing system, do not create a new system.

If a request can be satisfied by consuming existing authoritative data, do not create new calculations.

If a request can be satisfied by modifying an existing function, do not create parallel functionality.

The safest change that accomplishes the goal is preferred over the most sophisticated change.
