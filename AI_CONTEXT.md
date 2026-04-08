# **AI_CONTEXT.md**

# Project: Audio-First Mech Shooter (Hybrid 2D + Spatial Audio)

This document defines the architecture, design principles, coding conventions, and system expectations for the project. All AI assistants (including GitHub Copilot) must follow this specification unless explicitly overridden.

---

## 1. Project Overview

This is an **audio-first first-person mech shooter**, inspired by the feel of the Armored Core series. The game is:

* **Single-player offline by default**
* With **optional future multiplayer**
* Built using a **2D hybrid rendering model** with spatial audio providing the 3D experience
* Designed for **desktop and mobile**
* Built for **accessibility**, with a focus on screen-reader clarity
* Developed in **TypeScript** on both frontend and backend
* Architected for long-term maintainability and deterministic behavior when needed

Visuals support sighted players without being required for gameplay.

Audio contains elevation, direction, distance, and dynamic effects via **Tone.js** + **Web Audio API**.

---

## 2. Technology Stack

### Frontend (Browser)

* **Phaser 3** (WebGL renderer)
* **Tone.js** (procedural and reactive audio)
* **Web Audio API** (3D spatial panning, elevation, cones, doppler)
* **TypeScript**
* **WebSockets/Colyseus client** (multiplayer future support)

### Backend (Node.js)

* **Node 20+**
* **TypeScript**
* **Colyseus** (or WebSocket framework) for multiplayer sessions
* **Game logic simulation** for multiplayer; local simulation otherwise
* **Express** (optional) for updates or asset hosting

### Build & Project Structure

* **Monorepo**
* **npm workspaces**
* Simple folder-based asset pipeline (no Vite/Webpack unless needed later)

---

## 3. Architectural Principles

### 3.1 Hybrid Simulation Model

* **Single-player/offline**: Entire world simulated locally on client.
* **Multiplayer**: Server becomes authoritative.

  * Server validates inputs and runs the simulation.
  * Clients send actions, receive authoritative world snapshots or delta updates.
  * Simulation on clients interpolates for smooth rendering.

### 3.2 Rendering Model

* 2D tile/grid logic with a **z-height attribute** for entities.
* Camera first-person via HUD + audio rather than literal 3D rendering.
* Visual layers:

  * Cockpit HUD
  * Radar/lock indicators
  * Minimal world shapes, sprites, silhouettes, particles

### 3.3 Audio Model

* Tone.js handles:

  * Engine hums
  * Weapon charge cycles
  * Procedural ambience
  * Synthesized mech UI beeps
* Web Audio API handles:

  * 3D positional panning
  * Cone-based directionality
  * Distance falloff
  * Height (elevation) modeling

Spatial audio is prioritized over visuals.

---

## 4. Determinism and Timing

Because the project may support multiplayer, but determinism isn’t fully decided yet:

* Code should be structured **as if determinism may be enabled later**.
* All randomness must use a seedable RNG wrapper if determinism is required.
* Game loop must support:

  * fixed timestep updates
  * or hybrid fixed/variable
* Physics and combat logic should be modular enough to run in either:

  * client-only mode
  * server authoritative mode

---

## 5. Folder Structure (Monorepo)

```
/project-root
  /packages
    /client
      /src
        /audio
        /phaser
        /scenes
        /ui
        /net
        /types
      /assets
        /audio
        /sprites
        /ui
      tsconfig.json

    /server
      /src
        /rooms
        /simulation
        /net
        /types
      tsconfig.json

    /shared
      /src
        /math
        /types
        /constants
        /utils
      tsconfig.json

  package.json
  README.md
  AI_CONTEXT.md
```

Shared types must live in `/packages/shared` and be imported by both client and server.

---

## 6. Code Style & Conventions

### General

* **TypeScript everywhere**
* **Semi-strict linting** (ESLint recommended rules)
* **Prettier optional**
* Prefer pure functions where possible
* All module imports must be explicit (no wildcard imports)

### Naming

* File names: `kebab-case`
* Functions & variables: `camelCase`
* Classes & types: `PascalCase`
* Constants: `UPPER_SNAKE_CASE`

### Function Design

* No global state outside engine initialization
* Clear parameter types and return types
* No “magic numbers”; use constants or enums

### Brace Tracking (Accessibility Requirement)

Every closing brace `}` must have a trailing comment that clarifies what is being closed. Examples:

```ts
if (condition) {
  doThing()
} // end if condition

function makeSound() {
  return true
} // end function makeSound

class AudioManager {
  /* ... */
} // end class AudioManager
```

This rule is **mandatory**.

### Comments

* Prefer concise, meaningful comments
* Describe *why*, not “what”
* Avoid overly clever phrasing

---

## 7. Multiplayer Rules

### Single-player (default)

* Client runs simulation
* No server dependency
* Same code paths used as multiplayer when possible

### Multiplayer (optional)

* Server runs authoritative simulation
* Client performs prediction/interpolation
* Server periodically sends:

  * full world snapshots
  * or delta updates

### Shared Types

* All world state interfaces, mech stats, projectile definitions, etc. must live in `packages/shared`.

---

## 8. Phaser Standards

### Required practices:

* One root `Game` instance per session.
* Each HUD piece isolated into components/modules.
* No inline assets; load all assets from `/assets`.
* Maintain a strict separation:

  * **Scene logic**
  * **Rendering**
  * **Game state**

### Coordinate System

* World coordinates: `{ x, y, z }`
* Phaser visuals use `{ x, y }` only
* `z` influences:

  * audio height
  * sprite scaling (if needed)
  * shadow size
  * UI indicators

---

## 9. Audio Standards

### Spatial Audio Responsibilities

* Web Audio API handles:

  * Listener position = player
  * Panner nodes for enemies/projectiles
  * Smooth continuous updates each frame

### Tone.js Responsibilities

* Procedural SFX
* Looping engine rumble
* Boost effects
* UI cues
* Layered weapon firing audio

### Rule

Audio must never block gameplay. Creation and disposal of nodes must be efficient.

---

## 10. Copilot Guidelines

Copilot must follow:

1. **TypeScript** for all code.
2. Brace-tracking comments.
3. Semi-strict formatting.
4. Always use shared types from `/packages/shared` when applicable.
5. No 3D libraries (no three.js).
6. Phaser 3 for rendering only.
7. Tone.js + Web Audio for audio.
8. No undocumented APIs.
9. Suggest deterministic patterns but do not enforce them unless asked.
10. Prioritize readability and NVDA-friendly structure.

Copilot should:

* Ask clarifying questions when ambiguous.
* Prefer modular, small files.
* Not generate dead code or stubs unless instructed.

---

## 11. Accessibility Requirements

* Color choices must remain within legible contrast ranges.
* HUD elements must:

  * avoid motion blur
  * be large enough for magnifier users
  * avoid long animations that obscure information
* Navigation must not trap keyboard users.
* Audio cues must have clear directional and distance information.

---

## 12. Future-Proofing

This architecture supports:

* Optional deterministic lockstep later
* Full multiplayer expansion
* Procedural enemy AI
* Modular content (missions, mechs, weapons)
* Platform-agnostic playability

---

# End of AI_CONTEXT.md
