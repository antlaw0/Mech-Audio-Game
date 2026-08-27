# Mech-Audio-Game

Audio-first mech shooter project scaffolded as a TypeScript monorepo.

## Monorepo Layout

- packages/shared: Shared constants, types, and deterministic-friendly helpers.
- packages/client: Modular browser client for the test map.
- packages/server: Authoritative WebSocket simulation server scaffold.

## Requirements

- Node.js 20+
- npm 10+

## VS Code Stability

- Open the project using `Mech-Audio-Game.dev.code-workspace` instead of opening the folder directly.
- The workspace file includes file-watcher exclusions for large audio/content folders and helps prevent editor stalls.

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

The root build command compiles the shared package before the client and server packages. The root type-check command establishes the same shared-package prerequisite automatically:

```bash
npm run typecheck
```

Parts catalog source of truth:

- `packages/client/src/data/parts/parts.json` is authoritative.
- Client build now always syncs that source file to `packages/client/dist/data/parts/parts.json`.
- Local browser catalog overrides are disabled, so runtime always reloads from `parts.json`.

## Run Server

```bash
npm run build:server
npm run dev:server
```

The server listens on ws://localhost:8080.

## Run Test Map

The test map is compiled TypeScript in the browser:

- Source files live in `packages/client/src/test-map/*`
- The browser loads compiled output from `packages/client/dist/test-map/main.js`

If `dist` is stale, recent fixes in `src` will not appear in-game.

Recommended local workflows:

```bash
# Builds client once, then serves static files
npm run dev:static
```

```bash
# Watches TypeScript and serves static files (best while iterating)
npm run dev
```

```bash
# Full playtest stack (server + TS watch + static server)
npm run dev:playtest
```

## Promote Garage Catalog Edits To Source

Use Garage developer mode export to download a catalog JSON, then apply it to source:

```bash
npm run catalog:apply -- ./path/to/garage-catalog-YYYY-MM-DD.json --allow-parts-json-write
```

Quick apply using your most recent export (project root, exports folder, or Downloads):

```bash
npm run catalog:apply:latest
```

This command validates schema, writes a timestamped backup under `packages/client/src/data/parts/backups/`, and then updates `packages/client/src/data/parts/parts.json`.

## Notes

- The current client implementation preserves prototype gameplay and rendering behavior while splitting into focused modules under 250 lines.
- Networking in client is prepared with a lightweight WebSocket adapter for future server sync wiring.
- Colyseus is intentionally deferred; WebSocket architecture is in place for current milestone.
