# Audio Signal Flow and Node Graph

This document describes the current runtime audio architecture in the client test-map audio stack.

Primary implementation references:
- packages/client/src/test-map/audio.ts
- packages/client/src/test-map/spatial-audio.ts

## 1) High-level routing overview

The project currently uses two output paths:

1. Tone.js destination path (non-spatial and UI-centric audio)
- Source nodes are connected to Tone.getDestination() either directly or through effect chains ending in .toDestination().

2. Resonance Audio 3D path (world-positioned audio)
- Source nodes are connected to SpatialAudioEmitter.input.
- The emitter feeds a Resonance source in a shared ambisonic scene.
- The shared Resonance scene output is connected to AudioContext.destination.

Important practical note:
- Both paths ultimately reach the same hardware output, but they use separate intermediate mixers.
- The master channel (set via Tone.getDestination().volume) controls Tone-routed signals.
- HTMLAudioElement volume controls and Resonance-emitter gain stages are handled separately in code.

## 2) Source routing

### 2.1 Enemy audio source routing

Enemy sources are grouped in EnemyAudioRuntime and routed through one enemy chain per enemy runtime.

Per-enemy source group:
- Loop sources:
  - idleLoop (Tone.Player)
  - movementLoop (Tone.Player)
- One-shot players:
  - passivePing
  - threatCue
  - attackSound
  - attackVariants (burst variants)
  - hurtSound
  - deathSound
- Synth sources:
  - turnCueSynth
  - radarEchoSynth

Per-enemy graph:

```text
idleLoop ---------> idleGain ---\
movementLoop -----> movementGain --+--> lowpass filter --> gain --> emitter.input --> Resonance source --> shared scene output --> destination
oneshots/synth ---> oneshotGain --/
```

Detailed comments:
- idleGain and movementGain control loop blend behavior.
- oneshotGain allows attack/hurt/death/cue sounds to share the same filter and gain envelope context as loops.
- The final filter and gain are continuously modulated per frame for occlusion and distance shaping.
- emitter.setPosition is called every frame update for each enemy runtime.

### 2.2 Player and cockpit source routing

Player and cockpit effects are mostly non-spatial and routed to Tone destination through dedicated subchains.

Examples:
- Player fire: Tone.Player -> destination
- Reload servo chain:
  - Tone.Player -> lowpass -> distortion -> pitch shift -> reloadServoGain -> destination
- Flight loop chain:
  - Rotor/jet player(s) -> distortion -> lowpass -> flightBoostGain -> flightLoopGain -> destination
- Energy status chain:
  - energy loop player -> distortion -> lowpass -> tremolo -> energyStatusGain -> destination
- Heat status chain:
  - white noise -> distortion -> bandpass -> highpass -> heatStatusSizzleGain -> destination

Detailed comments:
- Cockpit/system feedback intentionally uses non-spatial routing so feedback stays legible regardless of camera pose.
- Most of these chains expose gain/filter/distortion parameters that are changed during frame updates.

### 2.3 Near-miss and impact source routing

Projectile and impact effects are routed into world emitters for spatial playback.

Examples:
- impactSynth -> impactEmitter.input -> Resonance scene
- bullet near-miss players -> bulletNearMissGain -> bulletNearMissEmitter.input -> Resonance scene
- projectile near-miss players -> projectileNearMissGain -> projectileNearMissEmitter.input -> Resonance scene
- incoming projectile loop voices:
  - Tone.Player(looping) -> voice gain -> emitter.input -> Resonance scene

Detailed comments:
- These voices rely on emitter position updates to preserve front/back and lateral localization.
- Min/max distance configuration on each emitter controls attenuation behavior per effect family.

## 3) Filtering stages

### 3.1 Enemy filter stages

Per enemy runtime there is a dedicated lowpass filter node before final gain.

Filtering behavior:
- Baseline cutoff is derived from distance and enemy altitude.
- If line-of-sight is blocked, cutoff is clamped to an occlusion ceiling.

Per-frame control inputs:
- distanceToFilter(distance)
- enemy.height contribution
- hasSightLine flag

Detailed comments:
- This produces muffling under occlusion without muting the source.
- Because filtering is per enemy runtime, each enemy can have different occlusion state in the same frame.

### 3.2 Cockpit/system filter stages

Notable non-spatial filter chains:
- Reload servo: lowpass + distortion + pitch stage
- Flight boost: lowpass + distortion
- Energy status: lowpass after distortion and tremolo
- Heat status: highpass + bandpass + mild distortion
- Mobility placeholders: multiple lowpass/bandpass/highpass filters per mobility archetype

Detailed comments:
- These are tonal shaping stages rather than world occlusion stages.
- They model mechanical character and urgency (heat/energy) in a consistent cockpit mix.

## 4) Spatialization stages

### 4.1 Resonance shared scene and emitters

SpatialAudioEmitter wraps a Resonance source and exposes:
- input node for source connection
- setPosition
- setOrientation
- setGain
- setDistanceRange (min/max)
- setDirectivity

SharedSpatialAudioScene owns:
- single Resonance scene instance
- scene output -> destination
- listener pose update from camera each frame
- emitter creation and lifecycle management

### 4.2 Listener-relative spatial transform

The current scene runs listener-relative positioning mode.

Transform concept:
- Listener is pinned at origin in audio space.
- World sources are transformed into listener-relative coordinates.
- Yaw from camera forward vector is used to rotate world delta into right/forward axes.

Key behavior comment:
- Source positions must be transformed using both source world position and current listener pose.
- Even if world source coordinates are unchanged, transformed coordinates can change when listener moves/rotates.
- The emitter update path now refreshes transformed position when a position transform is active, preventing stale panning.

### 4.3 Additional HRTF panners in Tone path

Some navigation/assist cues use Tone.Panner3D directly with HRTF model.

Example pattern:
- cue player/synth -> Tone.Panner3D(HRTF, inverse distance) -> gain -> destination

Detailed comments:
- This is separate from Resonance but still spatialized.
- Use-case is directional UI/navigation cues rather than physically persistent world emitters.

## 5) Environmental effects

Current environmental treatment is mostly procedural and filter/gain based.

### 5.1 Occlusion and line-of-sight muffling

Applied in enemy runtime update:
- hasSightLine gates whether lowpass cutoff is clamped.
- Occluded sources remain audible but spectrally reduced.

### 5.2 Distance and altitude shaping

Applied in enemy runtime update:
- distance-based gain attenuation
- altitude contribution to filter and pitch responses

### 5.3 Zone ambience blending

HTML ambience path crossfades between base ambience and city ambience:
- cityAmbienceMix is computed from player distance to the city zone bounds.
- ambience volumes are blended every frame.

### 5.4 Sonar and environment sensing cues

Navigation/sonar systems produce procedural cues for obstacles and contacts.

Detailed comments:
- These cues are treated as functional environment feedback layers.
- They are category-gated (objects/enemies/navigation) and can be suppressed in specific contexts.

## 6) Mixer hierarchy

The runtime mixer model is hybrid:

### 6.1 Tone destination hierarchy (Tone graph)

Top-level control:
- master volume channel writes to Tone.getDestination().volume.

Submix-style gains (examples):
- cardinalHeadingGain
- reloadServoGain
- flightLoopGain
- energyStatusGain
- heatStatusSizzleGain
- mobilityPlaceholderMasterGain
- boostEngageGain
- hardLandingGain

Detailed comments:
- Each subsystem chain controls local tone/effect balance before reaching destination.
- Master channel scales these Tone-routed signals globally.

### 6.2 Resonance hierarchy (world spatial graph)

Top-level world-spatial path:

```text
Tone source -> SpatialAudioEmitter.input -> Resonance source -> shared Resonance scene -> AudioContext.destination
```

Per-emitter controls:
- gain
- minDistance
- maxDistance
- directivity
- position/orientation

Listener controls:
- camera position/orientation mapped into scene listener state

Detailed comments:
- This path is where physically world-positioned enemy and projectile cues live.
- It is intentionally centralized through one shared scene to avoid multi-scene phase and listener conflicts.

### 6.3 HTMLAudioElement hierarchy

Separate from Tone graph, HTML audio elements handle:
- ambience
- city ambience
- music
- servo loop
- footstep and terrain-step clips

Per-frame volume controls:
- masterVolume and per-channel volume multipliers
- cityAmbienceMix crossfade

Detailed comments:
- These are not routed through Resonance or Tone node graphs.
- They are mixed by browser media element playback and controlled through element volume/playbackRate.

## 7) Category and channel controls

Volume channels include:
- master
- ambience
- music
- servo
- footsteps
- flightLoop
- energyStatus
- proximity
- objects
- enemies
- navigation

Category enable flags:
- proximity
- objects
- enemies
- navigation

Detailed comments:
- Category toggles primarily gate cue emission behavior.
- Enemy runtime movement/firing/reloading update continues each frame, while some cue families are category-gated.

## 8) Lifecycle and update cadence

Per-frame in updateFrameAudio:
1. Update ambience zone blend and apply HTML volumes.
2. Early out if audio system is not active.
3. Update shared spatial listener pose from camera.
4. Update each enemy runtime (position, occlusion/filter, gain, movement state).
5. Remove disposed/stale runtimes for enemies no longer active.
6. Update navigation/sonar and assist layers.

Detailed comments:
- Enemy runtime update is the central place where distance, LOS, filter, and spatial position converge.
- Listener update order before enemy updates is important for correct listener-relative transforms.

## 9) Current constraints and extension points

Current constraints:
- No global room reverb send/return bus is currently defined in this stack.
- Environmental coloration is mostly done via per-source filter/gain automation.
- Hybrid pipeline means Tone/HTML/Resonance paths are controlled by different gain mechanisms.

Recommended extension points:
- Add dedicated shared reverb/early-reflection send buses for world emitters.
- Route more UI cues through a consistent submix abstraction for easier debugging.
- Add optional runtime graph dump utility to print active node families and emitter counts.

## 10) Quick debug checklist for spatial issues

If a source sounds distance-only and not directional:
1. Confirm source is connected to emitter.input (not directly to destination).
2. Confirm emitter.setPosition is called during frame updates.
3. Confirm listener pose updates each frame before emitter updates.
4. Confirm emitter distance range is sane (minDistance and maxDistance).
5. Confirm category volume/mute states are not masking directional cues.
6. Confirm any direct Tone.Panner3D cue path is not being confused with Resonance emitter output.
