import { PLAYER_EYE_HEIGHT, isWorldBlockedAtHeight, traceWorldHit3D, type WorldCollisionWorld, type WorldTraceHit } from './world-collision.js'
import type { AudioOcclusionDiagnostics, AudioOcclusionRayDiagnostic, WorldPosition } from './types.js'

type AcousticObstacleType = WorldTraceHit['obstacleType']

type EmitterEntityId = string | number

interface MaterialOcclusionProfile {
  absorption: number
  thicknessScale: number
  acoustic: boolean
}

interface OcclusionEmitterInput {
  entityId: EmitterEntityId
  position: WorldPosition
  importance?: number
}

interface OcclusionFrameInput {
  dtSeconds: number
  world: WorldCollisionWorld
  listener: WorldPosition
  emitters: OcclusionEmitterInput[]
}

interface OcclusionSystemOptions {
  maxQueriesPerFrame?: number
  minUpdateIntervalSeconds?: number
  maxUpdateIntervalSeconds?: number
  smoothingSeconds?: number
  sampleRadius?: number
  maxBlockersPerRay?: number
  debugLogging?: boolean
}

interface RaySample {
  lateralOffset: number
  verticalOffset: number
  weight: number
}

interface BlockerAccumulator {
  blockerCount: number
  totalThickness: number
  weightedAbsorption: number
}

interface EmitterRuntimeState {
  key: string
  entityId: EmitterEntityId
  position: WorldPosition
  importance: number
  distanceToListener: number
  nextQueryAt: number
  targetOcclusion: number
  smoothedOcclusion: number
  diagnostics: AudioOcclusionDiagnostics
  lastTouchedFrame: number
}

const EPSILON = 0.0001
const DEFAULT_SAMPLE_RADIUS = 0.06
const DEFAULT_MAX_QUERIES_PER_FRAME = 6
const DEFAULT_MIN_UPDATE_INTERVAL_SECONDS = 0.08
const DEFAULT_MAX_UPDATE_INTERVAL_SECONDS = 0.75
const DEFAULT_SMOOTHING_SECONDS = 0.12
const DEFAULT_MAX_BLOCKERS_PER_RAY = 4

const RAY_BUNDLE_HIGH_QUALITY: readonly RaySample[] = [
  { lateralOffset: 0, verticalOffset: 0, weight: 2.2 },
  { lateralOffset: -0.28, verticalOffset: 0, weight: 1.1 },
  { lateralOffset: 0.28, verticalOffset: 0, weight: 1.1 },
  { lateralOffset: 0, verticalOffset: 0.3, weight: 0.9 },
  { lateralOffset: 0, verticalOffset: -0.25, weight: 0.7 }
]

const RAY_BUNDLE_BALANCED: readonly RaySample[] = [
  { lateralOffset: 0, verticalOffset: 0, weight: 2.0 },
  { lateralOffset: -0.26, verticalOffset: 0, weight: 1.0 },
  { lateralOffset: 0.26, verticalOffset: 0, weight: 1.0 }
]

const RAY_BUNDLE_LOW: readonly RaySample[] = [
  { lateralOffset: 0, verticalOffset: 0, weight: 1.0 }
]

const MATERIAL_PROFILES: Record<AcousticObstacleType, MaterialOcclusionProfile> = {
  wall: { absorption: 0.82, thicknessScale: 1.0, acoustic: true },
  pillar: { absorption: 0.76, thicknessScale: 0.9, acoustic: true },
  rock: { absorption: 0.7, thicknessScale: 0.82, acoustic: true },
  tree: { absorption: 0.38, thicknessScale: 0.45, acoustic: true }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function lerp(from: number, to: number, alpha: number): number {
  return from + ((to - from) * alpha)
}

function toKey(entityId: EmitterEntityId): string {
  return String(entityId)
}

function computeDistance(a: WorldPosition, b: WorldPosition): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.hypot(dx, dy, dz)
}

function clonePosition(position: WorldPosition): WorldPosition {
  return {
    x: position.x,
    y: position.y,
    z: position.z
  }
}

function emptyDiagnostics(entityId: EmitterEntityId): AudioOcclusionDiagnostics {
  return {
    entityId,
    blockerCount: 0,
    blockerThickness: 0,
    materialAbsorption: 0,
    occlusionAmount: 0,
    smoothedOcclusionAmount: 0,
    sampledRayCount: 0,
    lastQueryTimeSeconds: 0,
    rays: []
  }
}

export class AudioOcclusionSystem {
  private readonly runtimeStates = new Map<string, EmitterRuntimeState>()

  private readonly maxQueriesPerFrame: number
  private readonly minUpdateIntervalSeconds: number
  private readonly maxUpdateIntervalSeconds: number
  private readonly smoothingSeconds: number
  private readonly sampleRadius: number
  private readonly maxBlockersPerRay: number

  private debugLogging: boolean
  private debugVisualizationHook: ((diagnostic: AudioOcclusionDiagnostics) => void) | null = null

  private nowSeconds = 0
  private frameCounter = 0

  private readonly highQualityDistanceThreshold = 22
  private readonly balancedDistanceThreshold = 48

  constructor(options?: OcclusionSystemOptions) {
    this.maxQueriesPerFrame = Math.max(1, Math.floor(options?.maxQueriesPerFrame ?? DEFAULT_MAX_QUERIES_PER_FRAME))
    this.minUpdateIntervalSeconds = Math.max(0.01, options?.minUpdateIntervalSeconds ?? DEFAULT_MIN_UPDATE_INTERVAL_SECONDS)
    this.maxUpdateIntervalSeconds = Math.max(this.minUpdateIntervalSeconds, options?.maxUpdateIntervalSeconds ?? DEFAULT_MAX_UPDATE_INTERVAL_SECONDS)
    this.smoothingSeconds = Math.max(0.01, options?.smoothingSeconds ?? DEFAULT_SMOOTHING_SECONDS)
    this.sampleRadius = Math.max(0.01, options?.sampleRadius ?? DEFAULT_SAMPLE_RADIUS)
    this.maxBlockersPerRay = Math.max(1, Math.floor(options?.maxBlockersPerRay ?? DEFAULT_MAX_BLOCKERS_PER_RAY))
    this.debugLogging = options?.debugLogging ?? false
  }

  setDebugLogging(enabled: boolean): void {
    this.debugLogging = enabled
  }

  setDebugVisualizationHook(hook: ((diagnostic: AudioOcclusionDiagnostics) => void) | null): void {
    this.debugVisualizationHook = hook
  }

  update(frame: OcclusionFrameInput): void {
    this.frameCounter += 1
    this.nowSeconds += Math.max(0, frame.dtSeconds)

    const activeKeys = new Set<string>()

    for (const emitter of frame.emitters) {
      const key = toKey(emitter.entityId)
      activeKeys.add(key)

      const existing = this.runtimeStates.get(key)
      const distanceToListener = computeDistance(frame.listener, emitter.position)

      if (!existing) {
        this.runtimeStates.set(key, {
          key,
          entityId: emitter.entityId,
          position: clonePosition(emitter.position),
          importance: clamp(emitter.importance ?? 0.5, 0, 1),
          distanceToListener,
          nextQueryAt: 0,
          targetOcclusion: 0,
          smoothedOcclusion: 0,
          diagnostics: emptyDiagnostics(emitter.entityId),
          lastTouchedFrame: this.frameCounter
        })
        continue
      }

      existing.position.x = emitter.position.x
      existing.position.y = emitter.position.y
      existing.position.z = emitter.position.z
      existing.importance = clamp(emitter.importance ?? existing.importance, 0, 1)
      existing.distanceToListener = distanceToListener
      existing.lastTouchedFrame = this.frameCounter
    }

    for (const [key] of this.runtimeStates) {
      if (!activeKeys.has(key)) {
        this.runtimeStates.delete(key)
      }
    }

    const due = [...this.runtimeStates.values()]
      .filter((state) => this.nowSeconds >= state.nextQueryAt)
      .sort((a, b) => this.computePriorityScore(frame.listener, b) - this.computePriorityScore(frame.listener, a))

    const queryCount = Math.min(this.maxQueriesPerFrame, due.length)
    for (let index = 0; index < queryCount; index += 1) {
      const state = due[index]
      if (!state) {
        continue
      }
      this.computeOcclusionForEmitter(frame.world, frame.listener, state)
      state.nextQueryAt = this.nowSeconds + this.computeUpdateIntervalSeconds(state)
    }

    const smoothingAlpha = 1 - Math.exp(-Math.max(0, frame.dtSeconds) / this.smoothingSeconds)
    for (const state of this.runtimeStates.values()) {
      state.smoothedOcclusion = lerp(state.smoothedOcclusion, state.targetOcclusion, smoothingAlpha)
      state.diagnostics.smoothedOcclusionAmount = state.smoothedOcclusion
    }
  }

  getOcclusionAmount(entityId: EmitterEntityId): number {
    const state = this.runtimeStates.get(toKey(entityId))
    return state ? state.smoothedOcclusion : 0
  }

  getEmitterDiagnostics(entityId: EmitterEntityId): AudioOcclusionDiagnostics | null {
    const state = this.runtimeStates.get(toKey(entityId))
    if (!state) {
      return null
    }
    return {
      ...state.diagnostics,
      rays: state.diagnostics.rays.map((ray) => ({ ...ray }))
    }
  }

  getAllDiagnostics(): AudioOcclusionDiagnostics[] {
    return [...this.runtimeStates.values()].map((state) => ({
      ...state.diagnostics,
      rays: state.diagnostics.rays.map((ray) => ({ ...ray }))
    }))
  }

  private computePriorityScore(listener: WorldPosition, state: EmitterRuntimeState): number {
    const distance = Math.max(0.001, state.distanceToListener)
    const distanceWeight = 1 / (1 + (distance * 0.12))
    return (state.importance * 0.7) + (distanceWeight * 0.3)
  }

  private computeUpdateIntervalSeconds(state: EmitterRuntimeState): number {
    const distanceFactor = clamp(state.distanceToListener / 70, 0, 1)
    const baseInterval = lerp(this.minUpdateIntervalSeconds, this.maxUpdateIntervalSeconds, distanceFactor)
    const importanceScale = lerp(1, 0.5, state.importance)
    return clamp(baseInterval * importanceScale, this.minUpdateIntervalSeconds, this.maxUpdateIntervalSeconds)
  }

  private computeOcclusionForEmitter(world: WorldCollisionWorld, listener: WorldPosition, state: EmitterRuntimeState): void {
    const dx = state.position.x - listener.x
    const dy = state.position.y - listener.y
    const planarDistance = Math.hypot(dx, dy)
    if (planarDistance < EPSILON) {
      state.targetOcclusion = 0
      state.diagnostics = {
        ...emptyDiagnostics(state.entityId),
        lastQueryTimeSeconds: this.nowSeconds
      }
      return
    }

    const dirX = dx / planarDistance
    const dirY = dy / planarDistance
    const perpX = -dirY
    const perpY = dirX

    const rayBundle = this.selectRayBundle(state.distanceToListener, state.importance)
    const captureRayDiagnostics = this.debugLogging || this.debugVisualizationHook !== null

    let weightedOcclusionSum = 0
    let weightedBlockers = 0
    let weightedThickness = 0
    let weightedAbsorption = 0
    let rayWeightSum = 0
    const rays: AudioOcclusionRayDiagnostic[] = []

    for (const sample of rayBundle) {
      const start: WorldPosition = {
        x: listener.x + (perpX * sample.lateralOffset),
        y: listener.y + (perpY * sample.lateralOffset),
        z: listener.z + PLAYER_EYE_HEIGHT + sample.verticalOffset
      }

      const end: WorldPosition = {
        x: state.position.x + (perpX * sample.lateralOffset),
        y: state.position.y + (perpY * sample.lateralOffset),
        z: state.position.z + sample.verticalOffset
      }

      const rayResult = this.traceOcclusionRay(world, start, end)
      weightedOcclusionSum += rayResult.occlusionAmount * sample.weight
      weightedBlockers += rayResult.blockerCount * sample.weight
      weightedThickness += rayResult.totalThickness * sample.weight
      weightedAbsorption += rayResult.absorption * sample.weight
      rayWeightSum += sample.weight

      if (captureRayDiagnostics) {
        rays.push({
          start,
          end,
          blockerCount: rayResult.blockerCount,
          thickness: rayResult.totalThickness,
          absorption: rayResult.absorption,
          occlusionAmount: rayResult.occlusionAmount
        })
      }
    }

    const safeRayWeight = Math.max(EPSILON, rayWeightSum)
    const occlusion = clamp(weightedOcclusionSum / safeRayWeight, 0, 1)

    state.targetOcclusion = occlusion
    state.diagnostics = {
      entityId: state.entityId,
      blockerCount: weightedBlockers / safeRayWeight,
      blockerThickness: weightedThickness / safeRayWeight,
      materialAbsorption: weightedAbsorption / safeRayWeight,
      occlusionAmount: occlusion,
      smoothedOcclusionAmount: state.smoothedOcclusion,
      sampledRayCount: rayBundle.length,
      lastQueryTimeSeconds: this.nowSeconds,
      rays
    }

    if (this.debugLogging) {
      console.debug('[AudioOcclusion] emitter', {
        entityId: state.entityId,
        distance: state.distanceToListener,
        occlusion: occlusion.toFixed(3),
        blockers: (weightedBlockers / safeRayWeight).toFixed(2),
        thickness: (weightedThickness / safeRayWeight).toFixed(2),
        absorption: (weightedAbsorption / safeRayWeight).toFixed(2)
      })
    }

    this.debugVisualizationHook?.(state.diagnostics)
  }

  private selectRayBundle(distanceToListener: number, importance: number): readonly RaySample[] {
    if (importance >= 0.8 || distanceToListener <= this.highQualityDistanceThreshold) {
      return RAY_BUNDLE_HIGH_QUALITY
    }

    if (importance >= 0.35 || distanceToListener <= this.balancedDistanceThreshold) {
      return RAY_BUNDLE_BALANCED
    }

    return RAY_BUNDLE_LOW
  }

  private traceOcclusionRay(world: WorldCollisionWorld, start: WorldPosition, end: WorldPosition): {
    blockerCount: number
    totalThickness: number
    absorption: number
    occlusionAmount: number
  } {
    const totalDistance = computeDistance(start, end)
    if (totalDistance < EPSILON) {
      return {
        blockerCount: 0,
        totalThickness: 0,
        absorption: 0,
        occlusionAmount: 0
      }
    }

    const dirX = (end.x - start.x) / totalDistance
    const dirY = (end.y - start.y) / totalDistance
    const dirZ = (end.z - start.z) / totalDistance

    let cursorDistance = 0
    const accumulator: BlockerAccumulator = {
      blockerCount: 0,
      totalThickness: 0,
      weightedAbsorption: 0
    }

    for (let blockerIndex = 0; blockerIndex < this.maxBlockersPerRay; blockerIndex += 1) {
      if (cursorDistance >= totalDistance - 0.02) {
        break
      }

      const rayStart: WorldPosition = {
        x: start.x + (dirX * cursorDistance),
        y: start.y + (dirY * cursorDistance),
        z: start.z + (dirZ * cursorDistance)
      }

      const hit = traceWorldHit3D(world, rayStart, end, this.sampleRadius)
      if (!hit) {
        break
      }

      const profile = MATERIAL_PROFILES[hit.obstacleType]
      if (!profile.acoustic) {
        cursorDistance += Math.max(0.08, hit.distance + 0.05)
        continue
      }

      const hitDistanceFromListener = cursorDistance + hit.distance
      const thickness = this.measureBlockerThickness(world, hitDistanceFromListener, totalDistance, start, dirX, dirY, dirZ)
      const scaledThickness = thickness * profile.thicknessScale

      accumulator.blockerCount += 1
      accumulator.totalThickness += scaledThickness
      accumulator.weightedAbsorption += scaledThickness * profile.absorption

      cursorDistance = hitDistanceFromListener + Math.max(0.08, thickness + 0.04)
    }

    const blockerFactor = 1 - Math.exp(-accumulator.blockerCount * 0.58)
    const thicknessFactor = 1 - Math.exp(-accumulator.totalThickness * 0.85)
    const absorptionFactor = accumulator.totalThickness > EPSILON
      ? clamp(accumulator.weightedAbsorption / accumulator.totalThickness, 0, 1)
      : 0

    const occlusionAmount = clamp(
      (blockerFactor * 0.4) +
      (thicknessFactor * 0.4) +
      (absorptionFactor * 0.2),
      0,
      1
    )

    return {
      blockerCount: accumulator.blockerCount,
      totalThickness: accumulator.totalThickness,
      absorption: absorptionFactor,
      occlusionAmount
    }
  }

  private measureBlockerThickness(
    world: WorldCollisionWorld,
    fromDistance: number,
    totalDistance: number,
    start: WorldPosition,
    dirX: number,
    dirY: number,
    dirZ: number
  ): number {
    const step = 0.18
    let sampleDistance = fromDistance
    let thickness = 0
    let sampleCount = 0
    const maxSamples = 12
    const maxThickness = 2.2

    while (sampleDistance <= totalDistance && sampleCount < maxSamples) {
      const sampleX = start.x + (dirX * sampleDistance)
      const sampleY = start.y + (dirY * sampleDistance)
      const sampleZ = start.z + (dirZ * sampleDistance)
      const blocked = isWorldBlockedAtHeight(world, sampleX, sampleY, sampleZ, this.sampleRadius)

      if (!blocked) {
        break
      }

      thickness += step
      sampleDistance += step
      sampleCount += 1

      if (thickness >= maxThickness) {
        break
      }
    }

    return thickness
  }
}
