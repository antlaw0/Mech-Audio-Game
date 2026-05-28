# World Chunking System (Current State)

This document describes the current world chunking implementation in the test-map runtime.
It covers:
- what chunk systems exist,
- how they are laid out,
- how chunk state is used at runtime,
- and what is currently active vs legacy/unused.

## 1) World-Streaming Chunk Grid (Primary Runtime System)

The main chunking system is the world streaming manager.
It assigns each chunk one of three states:
- unloaded
- dormant
- active

### Configuration in current build

Current runtime config:
- chunkSize: 32 world units
- activeRadiusChunks: 2
- dormantRadiusChunks: 4
- maxActivationsPerFrame: 2
- maxTransitionsPerFrame: 10

Map dimensions are 1000 x 1000 world units, so the streaming manager pre-creates:
- chunk columns: ceil(1000 / 32) = 32
- chunk rows: ceil(1000 / 32) = 32
- total chunk records: 1024

Chunk key format is:
- chunkX,chunkY

Chunk coordinate math is:
- chunkX = floor(worldX / 32)
- chunkY = floor(worldY / 32)

### State layout around player

The observer is the player chunk.
Distance metric is Chebyshev distance:
- distance = max(abs(chunkX - observerX), abs(chunkY - observerY))

State by distance:
- active if distance <= 2
- dormant if 2 < distance <= 4
- unloaded if distance > 4

Steady-state ring counts around observer:
- active area is a 5 x 5 square = 25 chunks
- dormant area is outer square ring between radius 2 and 4:
  9 x 9 - 5 x 5 = 81 - 25 = 56 chunks
- total loaded (active + dormant) near player: 81 chunks

Note: transition budgets can temporarily delay reaching steady-state immediately after fast movement.

### Transition behavior

Per update pass:
- manager computes desired state for all chunk records,
- sorts transitions nearest-first,
- applies up to maxTransitionsPerFrame,
- limits active promotions to maxActivationsPerFrame.

Special rule for heavy promotions:
- unloaded -> active is forced through dormant first (unloaded -> dormant -> active across frames).

## 2) How Streaming Chunks Are Used

Chunk state is not just visual; it gates multiple subsystems.

### Collision workload gating

Collision world receives only active chunk keys via setWorldCollisionActiveChunks.
Raycasts query only collision chunks that are both:
- spatially overlapping the ray AABB, and
- currently in the active chunk key set.

### Rendering visibility gating

Three.js static world geometry is pre-grouped by chunk key.
Renderer visibility is set using:
- visible = active chunks + dormant chunks
- hidden = unloaded chunks

So dormant chunks still render, but are not part of active simulation workloads.

### AI and projectile simulation gating

Combat ECS uses streaming state callbacks:
- tanks only simulate when position is active (plus additional distance/cadence logic),
- projectiles are removed if in unloaded chunks,
- dormant projectiles can still update under reduced cadence and distance checks.

### Runtime filtering and metrics

Chunk state is also used to:
- filter displayed combat entities (exclude unloaded),
- filter lock-target candidates to active chunks,
- feed diagnostics counters (active/dormant/unloaded counts, transitions, per-frame costs).

## 3) Collision Chunk System (BVH Chunks)

Collision has its own chunk data structure (also size 32), built from:
- wall cells,
- round obstacles from sprites (trees, rocks, pillars).

Important distinction vs streaming grid:
- streaming grid creates all chunk records across map extents,
- collision chunk list is sparse and only contains chunks with collision geometry.

Each collision chunk stores:
- chunk key and bounds,
- hidden collision mesh,
- face type ranges (wall/tree/rock/pillar),
- per-chunk BVH data.

At world creation, collision starts with all collision chunks active, then runtime streaming updates the active set each frame.

## 4) Render Chunk System

Renderer chunking also uses chunk size 32 and chunk keys chunkX,chunkY.
Static walls and decor are assigned to chunk groups during renderer initialization.
Per frame, chunk visibility is driven by streaming state:
- active + dormant groups visible,
- unloaded groups hidden.

This keeps visual continuity beyond active simulation radius.

## 5) Additional Chunk Concept in Combat ECS (Spawn Ring)

Combat ECS defines a separate constant:
- WORLD_CHUNK_SIZE = 64

This is used in chooseChunkLocalSpawnCandidate to pick spawn locations in ring bands around player chunk with:
- min ring: 1
- max ring: 4

Current state:
- this helper exists but is not currently called in active spawn flow,
- active spawning currently uses radial distance candidates instead.

So this 64-size chunk ring is currently a dormant/legacy spawn utility, not the primary runtime chunk grid.

## 6) Practical Layout Summary

There are effectively three active chunk representations, all aligned on chunk keys and mostly on size 32:

1. Streaming state grid (dense, 32x32 records):
- authoritative runtime state machine (active/dormant/unloaded).

2. Collision chunks (sparse, size 32):
- BVH/collision acceleration, filtered by active keys.

3. Render static chunk groups (sparse-by-content, size 32):
- visibility controlled by active + dormant keys.

And one extra non-primary chunk notion:

4. Combat spawn ring chunks (size 64):
- helper logic, currently unused by default spawn path.

## 7) Current Behavior at a Glance

When player moves:
1. observer chunk updates,
2. streaming transitions states under per-frame budgets,
3. collision active set gets new active keys,
4. renderer visibility updates using active + dormant,
5. AI/projectile simulation decisions use active/dormant/unloaded checks.

This is the current chunking architecture in the test-map runtime as of May 27, 2026.
