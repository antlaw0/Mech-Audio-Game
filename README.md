# Mech-Audio-Game

Audio-first mech shooter project scaffolded as a TypeScript monorepo.

## Monorepo Layout

- packages/shared: Shared constants, types, and deterministic-friendly helpers.
- packages/client: Modular browser client for the test map.
- packages/server: Authoritative WebSocket simulation server scaffold.

## Requirements

- Node.js 20+
- npm 10+

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

## Run Server

```bash
npm run build:server
npm run dev:server
```

The server listens on ws://localhost:8080.

## Run Test Map

1. Build client output:

```bash
npm run build:client
```

2. Open test-map.html in a browser.

The test-map HTML loads modular compiled code from packages/client/dist/test-map/main.js.

## Notes

- The current client implementation preserves prototype gameplay and rendering behavior while splitting into focused modules under 250 lines.
- Networking in client is prepared with a lightweight WebSocket adapter for future server sync wiring.
- Colyseus is intentionally deferred; WebSocket architecture is in place for current milestone.
