# AI Guidance Rules

## General
- Follow all snippet rules exactly.
- Never invent data structures.
- Prefer small, readable functions.
- When adding a new system, generate both:
  - a high-level explanation
  - a full code implementation

## Code Generation
- Put closing braces with comments describing what is being closed.
- Keep naming consistent with naming.md.
- Align all logic with systems.md and data-formats.md.
- Keep functions pure when possible.

## Edge Cases
- Always validate tile coordinates.
- Enforce chunk boundaries during movement.
- Handle noise reaching zero explicitly.
- Handle null or missing entities safely.

## Comments
- All closing braces require comments.
- Use clear, concise comments describing purpose, not mechanics.

