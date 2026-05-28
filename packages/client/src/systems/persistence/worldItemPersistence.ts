import type { ItemDatabase } from '../inventory/itemDatabase.js'
import type { PickupSystem, LootContainerPickup, LoosePickup, PickupPosition, SpawnContainerOptions } from '../pickup/pickupSystem.js'

export interface PersistenceLimits {
  chunkSizeMeters: number
  maxLoosePerChunk: number
  maxContainersPerChunk: number
  maxLooseGlobal: number
  maxContainersGlobal: number
  looseMaxAgeMs: number
  containerMaxAgeMs: number
  rareItemMinRarity: number
} // end interface PersistenceLimits

export interface ChunkItemSummary {
  chunkKey: string
  looseCount: number
  containerCount: number
} // end interface ChunkItemSummary

export interface WorldItemPersistenceSnapshot {
  version: 1
  savedAtMs: number
  containers: Array<{
    id: string
    name: string
    type: LootContainerPickup['type']
    origin: LootContainerPickup['origin']
    position: PickupPosition
    interactionRadius: number
    items: LootContainerPickup['items']
    rarityPriority: number
    isPersistent: boolean
    autoRemoveWhenEmpty: boolean
    audioCueId?: string
  }>
} // end interface WorldItemPersistenceSnapshot

export interface PersistenceCleanupResult {
  removedLooseIds: string[]
  removedContainerIds: string[]
  looseBefore: number
  looseAfter: number
  containersBefore: number
  containersAfter: number
} // end interface PersistenceCleanupResult

export interface WorldItemPersistenceManager {
  getLimits(): PersistenceLimits
  setLimits(next: Partial<PersistenceLimits>): PersistenceLimits
  getChunkSummaries(): ChunkItemSummary[]
  cleanup(nowMs?: number): PersistenceCleanupResult
  createSnapshot(nowMs?: number): WorldItemPersistenceSnapshot
  loadSnapshot(snapshot: WorldItemPersistenceSnapshot): number
} // end interface WorldItemPersistenceManager

export interface CreateWorldItemPersistenceManagerOptions {
  pickupSystem: PickupSystem
  itemDatabase: ItemDatabase
  limits?: Partial<PersistenceLimits>
} // end interface CreateWorldItemPersistenceManagerOptions

const DEFAULT_LIMITS: PersistenceLimits = {
  chunkSizeMeters: 40,
  maxLoosePerChunk: 24,
  maxContainersPerChunk: 10,
  maxLooseGlobal: 240,
  maxContainersGlobal: 120,
  looseMaxAgeMs: 15 * 60 * 1000,
  containerMaxAgeMs: 40 * 60 * 1000,
  rareItemMinRarity: 3
}

const clampNumber = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value))
} // end function clampNumber

const normalizeLimits = (limits?: Partial<PersistenceLimits>): PersistenceLimits => {
  const merged: PersistenceLimits = {
    ...DEFAULT_LIMITS,
    ...(limits ?? {})
  }

  return {
    chunkSizeMeters: clampNumber(Number.isFinite(merged.chunkSizeMeters) ? merged.chunkSizeMeters : DEFAULT_LIMITS.chunkSizeMeters, 4, 256),
    maxLoosePerChunk: clampNumber(Math.floor(merged.maxLoosePerChunk), 1, 10000),
    maxContainersPerChunk: clampNumber(Math.floor(merged.maxContainersPerChunk), 1, 10000),
    maxLooseGlobal: clampNumber(Math.floor(merged.maxLooseGlobal), 1, 100000),
    maxContainersGlobal: clampNumber(Math.floor(merged.maxContainersGlobal), 1, 100000),
    looseMaxAgeMs: clampNumber(Math.floor(merged.looseMaxAgeMs), 1000, 1000 * 60 * 60 * 24 * 365),
    containerMaxAgeMs: clampNumber(Math.floor(merged.containerMaxAgeMs), 1000, 1000 * 60 * 60 * 24 * 365),
    rareItemMinRarity: clampNumber(Math.floor(merged.rareItemMinRarity), 1, 10)
  }
} // end function normalizeLimits

const getChunkKey = (position: PickupPosition, chunkSizeMeters: number): string => {
  const chunkX = Math.floor(position.x / chunkSizeMeters)
  const chunkY = Math.floor(position.y / chunkSizeMeters)
  return `${chunkX},${chunkY}`
} // end function getChunkKey

const getLooseRarity = (itemDatabase: ItemDatabase, pickup: LoosePickup): number => {
  return itemDatabase.getById(pickup.stack.itemId)?.rarity ?? 0
} // end function getLooseRarity

const getContainerRarity = (itemDatabase: ItemDatabase, container: LootContainerPickup): number => {
  const maxItemRarity = container.items.reduce((maxRarity, stack) => {
    const rarity = itemDatabase.getById(stack.itemId)?.rarity ?? 0
    return Math.max(maxRarity, rarity)
  }, 0)
  return Math.max(container.rarityPriority, maxItemRarity)
} // end function getContainerRarity

export const createWorldItemPersistenceManager = (
  options: CreateWorldItemPersistenceManagerOptions
): WorldItemPersistenceManager => {
  const { pickupSystem, itemDatabase } = options
  let limits = normalizeLimits(options.limits)

  const getChunkBuckets = (): Map<string, { looseIds: string[]; containerIds: string[] }> => {
    const buckets = new Map<string, { looseIds: string[]; containerIds: string[] }>()

    for (const pickup of pickupSystem.listLoosePickups()) {
      const key = getChunkKey(pickup.position, limits.chunkSizeMeters)
      const bucket = buckets.get(key) ?? { looseIds: [], containerIds: [] }
      bucket.looseIds.push(pickup.id)
      buckets.set(key, bucket)
    } // end for each loose pickup

    for (const container of pickupSystem.listContainers()) {
      const key = getChunkKey(container.position, limits.chunkSizeMeters)
      const bucket = buckets.get(key) ?? { looseIds: [], containerIds: [] }
      bucket.containerIds.push(container.id)
      buckets.set(key, bucket)
    } // end for each container

    return buckets
  } // end function getChunkBuckets

  const getChunkSummaries = (): ChunkItemSummary[] => {
    return Array.from(getChunkBuckets().entries())
      .map(([chunkKey, bucket]) => ({
        chunkKey,
        looseCount: bucket.looseIds.length,
        containerCount: bucket.containerIds.length
      }))
      .sort((left, right) => left.chunkKey.localeCompare(right.chunkKey))
  } // end function getChunkSummaries

  const cleanup = (nowMs = Date.now()): PersistenceCleanupResult => {
    const loose = pickupSystem.listLoosePickups()
    const containers = pickupSystem.listContainers()
    const looseBefore = loose.length
    const containersBefore = containers.length
    const removedLooseIds: string[] = []
    const removedContainerIds: string[] = []

    // Pass 1: age-based cleanup. Loose items expire sooner than containers.
    for (const entry of loose) {
      const ageMs = Math.max(0, nowMs - entry.createdAtMs)
      const rarity = getLooseRarity(itemDatabase, entry)
      if (ageMs > limits.looseMaxAgeMs && rarity < limits.rareItemMinRarity) {
        if (pickupSystem.removeLoosePickup(entry.id)) {
          removedLooseIds.push(entry.id)
        }
      }
    } // end for each loose age candidate

    for (const entry of containers) {
      const ageMs = Math.max(0, nowMs - entry.createdAtMs)
      const rarity = getContainerRarity(itemDatabase, entry)
      if (ageMs > limits.containerMaxAgeMs && rarity < limits.rareItemMinRarity && !entry.isPersistent) {
        if (pickupSystem.removeContainer(entry.id)) {
          removedContainerIds.push(entry.id)
        }
      }
    } // end for each container age candidate

    // Pass 2: enforce per-chunk and global caps with low-priority-first policy.
    const looseAfterAge = pickupSystem.listLoosePickups()
    const containersAfterAge = pickupSystem.listContainers()
    const looseById = new Map(looseAfterAge.map((entry) => [entry.id, entry]))
    const containerById = new Map(containersAfterAge.map((entry) => [entry.id, entry]))

    const sortedLooseIdsByPriority = Array.from(looseById.values())
      .sort((left, right) => {
        const leftRarity = getLooseRarity(itemDatabase, left)
        const rightRarity = getLooseRarity(itemDatabase, right)
        if (leftRarity !== rightRarity) {
          return leftRarity - rightRarity
        } // end if rarity differentiates
        return left.createdAtMs - right.createdAtMs
      })
      .map((entry) => entry.id)

    const sortedContainerIdsByPriority = Array.from(containerById.values())
      .sort((left, right) => {
        const leftRarity = getContainerRarity(itemDatabase, left)
        const rightRarity = getContainerRarity(itemDatabase, right)
        if (leftRarity !== rightRarity) {
          return leftRarity - rightRarity
        } // end if rarity differentiates
        if (left.rarityPriority !== right.rarityPriority) {
          return left.rarityPriority - right.rarityPriority
        } // end if explicit rarity priority differentiates
        return left.createdAtMs - right.createdAtMs
      })
      .map((entry) => entry.id)

    const chunkBuckets = getChunkBuckets()

    for (const [chunkKey, bucket] of chunkBuckets.entries()) {
      let looseOverflow = bucket.looseIds.length - limits.maxLoosePerChunk
      if (looseOverflow > 0) {
        for (const candidateId of sortedLooseIdsByPriority) {
          if (looseOverflow <= 0) {
            break
          }
          if (!bucket.looseIds.includes(candidateId)) {
            continue
          }
          if (pickupSystem.removeLoosePickup(candidateId)) {
            removedLooseIds.push(candidateId)
            looseOverflow -= 1
          }
        }
      }

      let containerOverflow = bucket.containerIds.length - limits.maxContainersPerChunk
      if (containerOverflow > 0) {
        for (const candidateId of sortedContainerIdsByPriority) {
          if (containerOverflow <= 0) {
            break
          }
          if (!bucket.containerIds.includes(candidateId)) {
            continue
          }
          const target = containerById.get(candidateId)
          if (target?.isPersistent) {
            continue
          } // end if skipping persistent container
          if (pickupSystem.removeContainer(candidateId)) {
            removedContainerIds.push(candidateId)
            containerOverflow -= 1
          }
        }
      }

      chunkBuckets.set(chunkKey, bucket)
    } // end for each chunk overflow

    const looseAfterChunk = pickupSystem.listLoosePickups()
    if (looseAfterChunk.length > limits.maxLooseGlobal) {
      const overflow = looseAfterChunk.length - limits.maxLooseGlobal
      const ids = looseAfterChunk
        .sort((left, right) => {
          const leftRarity = getLooseRarity(itemDatabase, left)
          const rightRarity = getLooseRarity(itemDatabase, right)
          if (leftRarity !== rightRarity) {
            return leftRarity - rightRarity
          }
          return left.createdAtMs - right.createdAtMs
        })
        .slice(0, overflow)
        .map((entry) => entry.id)
      for (const id of ids) {
        if (pickupSystem.removeLoosePickup(id)) {
          removedLooseIds.push(id)
        }
      }
    }

    const containersAfterChunk = pickupSystem.listContainers()
    if (containersAfterChunk.length > limits.maxContainersGlobal) {
      const overflow = containersAfterChunk.length - limits.maxContainersGlobal
      const ids = containersAfterChunk
        .filter((entry) => !entry.isPersistent)
        .sort((left, right) => {
          const leftRarity = getContainerRarity(itemDatabase, left)
          const rightRarity = getContainerRarity(itemDatabase, right)
          if (leftRarity !== rightRarity) {
            return leftRarity - rightRarity
          }
          if (left.rarityPriority !== right.rarityPriority) {
            return left.rarityPriority - right.rarityPriority
          }
          return left.createdAtMs - right.createdAtMs
        })
        .slice(0, overflow)
        .map((entry) => entry.id)
      for (const id of ids) {
        if (pickupSystem.removeContainer(id)) {
          removedContainerIds.push(id)
        }
      }
    }

    return {
      removedLooseIds,
      removedContainerIds,
      looseBefore,
      looseAfter: pickupSystem.listLoosePickups().length,
      containersBefore,
      containersAfter: pickupSystem.listContainers().length
    }
  } // end function cleanup

  const createSnapshot = (nowMs = Date.now()): WorldItemPersistenceSnapshot => {
    // Phase 8 rule: loose runtime drops do not persist through save/load.
    const persistentContainers = pickupSystem.listContainers()
      .filter((container) => container.isPersistent)
      .map((container) => ({
        id: container.id,
        name: container.name,
        type: container.type,
        origin: container.origin,
        position: container.position,
        interactionRadius: container.interactionRadius,
        items: container.items,
        rarityPriority: container.rarityPriority,
        isPersistent: container.isPersistent,
        autoRemoveWhenEmpty: container.autoRemoveWhenEmpty,
        audioCueId: container.audioCueId
      }))

    return {
      version: 1,
      savedAtMs: nowMs,
      containers: persistentContainers
    }
  } // end function createSnapshot

  const loadSnapshot = (snapshot: WorldItemPersistenceSnapshot): number => {
    if (snapshot.version !== 1) {
      throw new Error(`Unsupported world item persistence snapshot version: ${snapshot.version}`)
    } // end if snapshot version unsupported

    let loadedCount = 0
    for (const container of snapshot.containers) {
      const options: SpawnContainerOptions = {
        position: container.position,
        type: container.type,
        origin: container.origin,
        name: container.name,
        items: container.items,
        rarityPriority: container.rarityPriority,
        isPersistent: container.isPersistent,
        autoRemoveWhenEmpty: container.autoRemoveWhenEmpty,
        interactionRadius: container.interactionRadius,
        audioCueId: container.audioCueId
      }
      pickupSystem.spawnContainer(options)
      loadedCount += 1
    } // end for each persisted container

    return loadedCount
  } // end function loadSnapshot

  const getLimits = (): PersistenceLimits => ({ ...limits })
  const setLimits = (next: Partial<PersistenceLimits>): PersistenceLimits => {
    limits = normalizeLimits({ ...limits, ...next })
    return getLimits()
  } // end function setLimits

  return {
    getLimits,
    setLimits,
    getChunkSummaries,
    cleanup,
    createSnapshot,
    loadSnapshot
  }
} // end function createWorldItemPersistenceManager
