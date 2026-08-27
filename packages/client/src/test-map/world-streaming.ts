import { getCell } from './map-data.js'
import type { SpriteObject } from './types.js'
import { getChunkDistance, toChunkCoordinate, toChunkKey } from './chunk-coordinates.js'

export type WorldChunkState = 'unloaded' | 'dormant' | 'active'

export interface WorldStreamingConfig {
  chunkSize: number
  activeRadiusChunks: number
  dormantRadiusChunks: number
  maxActivationsPerFrame: number
  maxTransitionsPerFrame: number
}

export interface WorldStreamingDiagnostics {
  chunkSize: number
  observerChunk: { x: number; y: number }
  activeChunkCount: number
  dormantChunkCount: number
  unloadedChunkCount: number
  frameTransitions: number
  frameActivationMs: number
  frameCounters: {
    simulatedAiCount: number
    renderedEntityCount: number
    projectileUpdateCount: number
    audioEmitterCount: number
    targetRefinementCount: number
    effectUpdateCount: number
  }
  pipeline: {
    raycastCount: number
    audioNodeCount: number
    drawCalls: number
  }
}

interface WorldChunkRecord {
  key: string
  chunkX: number
  chunkY: number
  wallCount: number
  decorCount: number
  state: WorldChunkState
}

interface MutableFrameCounters {
  simulatedAiCount: number
  renderedEntityCount: number
  projectileUpdateCount: number
  audioEmitterCount: number
  targetRefinementCount: number
  effectUpdateCount: number
}

interface MutablePipelineCounters {
  raycastCount: number
  audioNodeCount: number
  drawCalls: number
}

export interface WorldStreamingManager {
  beginFrame: () => void
  update: (playerX: number, playerY: number) => void
  getChunkStateAt: (x: number, y: number) => WorldChunkState
  isPositionActive: (x: number, y: number) => boolean
  getActiveChunkKeys: () => string[]
  getDormantChunkKeys: () => string[]
  getDiagnostics: () => WorldStreamingDiagnostics
  recordSimulatedAi: (count: number) => void
  recordRenderedEntities: (count: number) => void
  recordProjectileUpdates: (count: number) => void
  recordAudioEmitters: (count: number) => void
  recordTargetRefinements: (count: number) => void
  recordEffectUpdates: (count: number) => void
  recordRaycasts: (count: number) => void
  recordAudioNodes: (count: number) => void
  recordDrawCalls: (count: number) => void
}

const DEFAULT_CHUNK_SIZE = 32
const DEFAULT_ACTIVE_RADIUS_CHUNKS = 2
const DEFAULT_DORMANT_RADIUS_CHUNKS = 4
const DEFAULT_MAX_ACTIVATIONS_PER_FRAME = 2
const DEFAULT_MAX_TRANSITIONS_PER_FRAME = 10

function resolveTargetState(distance: number, config: WorldStreamingConfig): WorldChunkState {
  if (distance <= config.activeRadiusChunks) {
    return 'active'
  }
  if (distance <= config.dormantRadiusChunks) {
    return 'dormant'
  }
  return 'unloaded'
}

function buildChunkRecords(
  mapData: Uint8Array,
  sprites: SpriteObject[],
  mapWidth: number,
  mapHeight: number,
  chunkSize: number
): Map<string, WorldChunkRecord> {
  const records = new Map<string, WorldChunkRecord>()

  const getOrCreate = (chunkX: number, chunkY: number): WorldChunkRecord => {
    const key = toChunkKey(chunkX, chunkY)
    const existing = records.get(key)
    if (existing) {
      return existing
    }

    const created: WorldChunkRecord = {
      key,
      chunkX,
      chunkY,
      wallCount: 0,
      decorCount: 0,
      state: 'unloaded'
    }
    records.set(key, created)
    return created
  }

  const chunkCols = Math.ceil(mapWidth / chunkSize)
  const chunkRows = Math.ceil(mapHeight / chunkSize)
  for (let chunkY = 0; chunkY < chunkRows; chunkY += 1) {
    for (let chunkX = 0; chunkX < chunkCols; chunkX += 1) {
      getOrCreate(chunkX, chunkY)
    }
  }

  for (let row = 0; row < mapHeight; row += 1) {
    for (let col = 0; col < mapWidth; col += 1) {
      if (getCell(mapData, col, row) === 0) {
        continue
      }
      const record = getOrCreate(toChunkCoordinate(col, chunkSize), toChunkCoordinate(row, chunkSize))
      record.wallCount += 1
    }
  }

  for (const sprite of sprites) {
    const record = getOrCreate(toChunkCoordinate(sprite.x, chunkSize), toChunkCoordinate(sprite.y, chunkSize))
    record.decorCount += 1
  }

  return records
}

export function createWorldStreamingManager(args: {
  mapData: Uint8Array
  sprites: SpriteObject[]
  mapWidth: number
  mapHeight: number
  config?: Partial<WorldStreamingConfig>
}): WorldStreamingManager {
  const config: WorldStreamingConfig = {
    chunkSize: Math.max(8, Math.floor(args.config?.chunkSize ?? DEFAULT_CHUNK_SIZE)),
    activeRadiusChunks: Math.max(0, Math.floor(args.config?.activeRadiusChunks ?? DEFAULT_ACTIVE_RADIUS_CHUNKS)),
    dormantRadiusChunks: Math.max(
      Math.max(1, Math.floor(args.config?.activeRadiusChunks ?? DEFAULT_ACTIVE_RADIUS_CHUNKS)),
      Math.floor(args.config?.dormantRadiusChunks ?? DEFAULT_DORMANT_RADIUS_CHUNKS)
    ),
    maxActivationsPerFrame: Math.max(1, Math.floor(args.config?.maxActivationsPerFrame ?? DEFAULT_MAX_ACTIVATIONS_PER_FRAME)),
    maxTransitionsPerFrame: Math.max(1, Math.floor(args.config?.maxTransitionsPerFrame ?? DEFAULT_MAX_TRANSITIONS_PER_FRAME))
  }

  const chunkRecords = buildChunkRecords(args.mapData, args.sprites, args.mapWidth, args.mapHeight, config.chunkSize)
  let observerChunkX = toChunkCoordinate(args.mapWidth * 0.5, config.chunkSize)
  let observerChunkY = toChunkCoordinate(args.mapHeight * 0.5, config.chunkSize)

  let frameTransitions = 0
  let frameActivationMs = 0

  const frameCounters: MutableFrameCounters = {
    simulatedAiCount: 0,
    renderedEntityCount: 0,
    projectileUpdateCount: 0,
    audioEmitterCount: 0,
    targetRefinementCount: 0,
    effectUpdateCount: 0
  }

  const pipelineCounters: MutablePipelineCounters = {
    raycastCount: 0,
    audioNodeCount: 0,
    drawCalls: 0
  }

  const beginFrame = (): void => {
    frameTransitions = 0
    frameActivationMs = 0
    frameCounters.simulatedAiCount = 0
    frameCounters.renderedEntityCount = 0
    frameCounters.projectileUpdateCount = 0
    frameCounters.audioEmitterCount = 0
    frameCounters.targetRefinementCount = 0
    frameCounters.effectUpdateCount = 0
    pipelineCounters.raycastCount = 0
    pipelineCounters.audioNodeCount = 0
    pipelineCounters.drawCalls = 0
  }

  const update = (playerX: number, playerY: number): void => {
    observerChunkX = toChunkCoordinate(playerX, config.chunkSize)
    observerChunkY = toChunkCoordinate(playerY, config.chunkSize)

    const transitions: Array<{ record: WorldChunkRecord; target: WorldChunkState; distance: number }> = []
    for (const record of chunkRecords.values()) {
      const distance = getChunkDistance(observerChunkX, observerChunkY, record.chunkX, record.chunkY)
      const desiredState = resolveTargetState(distance, config)
      if (desiredState !== record.state) {
        transitions.push({ record, target: desiredState, distance })
      }
    }

    transitions.sort((a, b) => a.distance - b.distance)

    let transitionsProcessed = 0
    let activationsProcessed = 0
    for (const transition of transitions) {
      if (transitionsProcessed >= config.maxTransitionsPerFrame) {
        break
      }

      if (transition.target === 'active' && activationsProcessed >= config.maxActivationsPerFrame) {
        continue
      }

      const activationStart = performance.now()

      // Force unloaded -> dormant -> active to spread the heaviest path across frames.
      if (transition.record.state === 'unloaded' && transition.target === 'active') {
        transition.record.state = 'dormant'
      } else {
        transition.record.state = transition.target
      }

      frameActivationMs += performance.now() - activationStart
      frameTransitions += 1
      transitionsProcessed += 1
      if (transition.record.state === 'active') {
        activationsProcessed += 1
      }
    }
  }

  const getChunkStateAt = (x: number, y: number): WorldChunkState => {
    const record = chunkRecords.get(toChunkKey(toChunkCoordinate(x, config.chunkSize), toChunkCoordinate(y, config.chunkSize)))
    return record?.state ?? 'unloaded'
  }

  const isPositionActive = (x: number, y: number): boolean => {
    return getChunkStateAt(x, y) === 'active'
  }

  const getChunkKeysByState = (state: WorldChunkState): string[] => {
    const keys: string[] = []
    for (const record of chunkRecords.values()) {
      if (record.state === state) {
        keys.push(record.key)
      }
    }
    return keys
  }

  const getDiagnostics = (): WorldStreamingDiagnostics => {
    const activeChunkCount = getChunkKeysByState('active').length
    const dormantChunkCount = getChunkKeysByState('dormant').length
    const unloadedChunkCount = chunkRecords.size - activeChunkCount - dormantChunkCount

    return {
      chunkSize: config.chunkSize,
      observerChunk: { x: observerChunkX, y: observerChunkY },
      activeChunkCount,
      dormantChunkCount,
      unloadedChunkCount,
      frameTransitions,
      frameActivationMs,
      frameCounters: {
        simulatedAiCount: frameCounters.simulatedAiCount,
        renderedEntityCount: frameCounters.renderedEntityCount,
        projectileUpdateCount: frameCounters.projectileUpdateCount,
        audioEmitterCount: frameCounters.audioEmitterCount,
        targetRefinementCount: frameCounters.targetRefinementCount,
        effectUpdateCount: frameCounters.effectUpdateCount
      },
      pipeline: {
        raycastCount: pipelineCounters.raycastCount,
        audioNodeCount: pipelineCounters.audioNodeCount,
        drawCalls: pipelineCounters.drawCalls
      }
    }
  }

  return {
    beginFrame,
    update,
    getChunkStateAt,
    isPositionActive,
    getActiveChunkKeys: () => getChunkKeysByState('active'),
    getDormantChunkKeys: () => getChunkKeysByState('dormant'),
    getDiagnostics,
    recordSimulatedAi: (count: number) => { frameCounters.simulatedAiCount += Math.max(0, Math.floor(count)) },
    recordRenderedEntities: (count: number) => { frameCounters.renderedEntityCount += Math.max(0, Math.floor(count)) },
    recordProjectileUpdates: (count: number) => { frameCounters.projectileUpdateCount += Math.max(0, Math.floor(count)) },
    recordAudioEmitters: (count: number) => { frameCounters.audioEmitterCount += Math.max(0, Math.floor(count)) },
    recordTargetRefinements: (count: number) => { frameCounters.targetRefinementCount += Math.max(0, Math.floor(count)) },
    recordEffectUpdates: (count: number) => { frameCounters.effectUpdateCount += Math.max(0, Math.floor(count)) },
    recordRaycasts: (count: number) => { pipelineCounters.raycastCount += Math.max(0, Math.floor(count)) },
    recordAudioNodes: (count: number) => { pipelineCounters.audioNodeCount = Math.max(0, Math.floor(count)) },
    recordDrawCalls: (count: number) => { pipelineCounters.drawCalls = Math.max(0, Math.floor(count)) }
  }
}
