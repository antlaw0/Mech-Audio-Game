import type { InventoryStack } from '../../data/items/types.js'
import type { ItemDatabase } from '../inventory/itemDatabase.js'
import type { InventoryManager } from '../inventory/inventoryManager.js'
import type { LootGenerator } from '../loot/lootGenerator.js'

export interface PickupPosition {
  x: number
  y: number
  z: number
} // end interface PickupPosition

export type PickupContainerType = 'container' | 'wreck' | 'corpse'
export type PickupContainerOrigin = 'static' | 'runtime'

export interface LoosePickup {
  id: string
  createdAtMs: number
  position: PickupPosition
  interactionRadius: number
  stack: InventoryStack
  autoPickup: boolean
  label?: string
} // end interface LoosePickup

export interface LootContainerPickup {
  id: string
  createdAtMs: number
  type: PickupContainerType
  origin: PickupContainerOrigin
  name: string
  position: PickupPosition
  interactionRadius: number
  items: InventoryStack[]
  rarityPriority: number
  isPersistent: boolean
  autoRemoveWhenEmpty: boolean
  audioCueId?: string
} // end interface LootContainerPickup

export interface PickupPrompt {
  id: string
  text: string
  accessibilityText: string
} // end interface PickupPrompt

export interface PickupUpdateResult {
  autoCollected: InventoryStack[]
  prompt: PickupPrompt | null
} // end interface PickupUpdateResult

export interface PickupCollectResult {
  sourceId: string
  sourceType: 'loose' | PickupContainerType
  collected: InventoryStack[]
} // end interface PickupCollectResult

export interface ContainerLootResult {
  containerId: string
  sourceType: PickupContainerType
  collected: InventoryStack[]
  remainingStacks: InventoryStack[]
  removed: boolean
} // end interface ContainerLootResult

export interface SpawnLoosePickupOptions {
  position: PickupPosition
  itemId: string
  quantity: number
  autoPickup?: boolean
  interactionRadius?: number
  label?: string
} // end interface SpawnLoosePickupOptions

export interface SpawnContainerOptions {
  position: PickupPosition
  type?: PickupContainerType
  origin?: PickupContainerOrigin
  name: string
  items: InventoryStack[]
  rarityPriority?: number
  isPersistent?: boolean
  autoRemoveWhenEmpty?: boolean
  interactionRadius?: number
  audioCueId?: string
} // end interface SpawnContainerOptions

export interface SpawnContainerFromLootTableOptions {
  position: PickupPosition
  tableId: string
  type?: PickupContainerType
  origin?: PickupContainerOrigin
  name?: string
  rarityPriority?: number
  isPersistent?: boolean
  autoRemoveWhenEmpty?: boolean
  interactionRadius?: number
  audioCueId?: string
} // end interface SpawnContainerFromLootTableOptions

export interface PickupSystemOptions {
  inventory: InventoryManager
  itemDatabase: ItemDatabase
  lootGenerator: LootGenerator
  interactionKeyLabel?: string
} // end interface PickupSystemOptions

export interface PickupSystem {
  spawnLoosePickup(options: SpawnLoosePickupOptions): LoosePickup
  spawnContainer(options: SpawnContainerOptions): LootContainerPickup
  spawnContainerFromLootTable(options: SpawnContainerFromLootTableOptions): LootContainerPickup
  spawnWreckFromEntityLoot(options: SpawnContainerFromLootTableOptions): LootContainerPickup
  updatePlayerPresence(playerPosition: PickupPosition): PickupUpdateResult
  getPrompt(playerPosition: PickupPosition): PickupPrompt | null
  interactNearest(playerPosition: PickupPosition): PickupCollectResult | null
  lootContainerItem(containerId: string, itemId: string, quantity: number): ContainerLootResult | null
  lootContainerAll(containerId: string): ContainerLootResult | null
  getContainer(containerId: string): LootContainerPickup | null
  removeLoosePickup(pickupId: string): boolean
  removeContainer(containerId: string): boolean
  listLoosePickups(): LoosePickup[]
  listContainers(): LootContainerPickup[]
  clearAll(): void
} // end interface PickupSystem

const DEFAULT_INTERACTION_RADIUS = 2.25

const toFiniteNumber = (value: number, fallback: number): number => {
  return Number.isFinite(value) ? value : fallback
} // end function toFiniteNumber

const normalizeQuantity = (quantity: number): number => {
  if (!Number.isFinite(quantity)) {
    return 0
  } // end if invalid quantity
  return Math.max(0, Math.floor(quantity))
} // end function normalizeQuantity

const distanceSquared = (left: PickupPosition, right: PickupPosition): number => {
  const dx = left.x - right.x
  const dy = left.y - right.y
  const dz = left.z - right.z
  return dx * dx + dy * dy + dz * dz
} // end function distanceSquared

const cloneStack = (stack: InventoryStack): InventoryStack => ({
  itemId: stack.itemId,
  quantity: stack.quantity
}) // end function cloneStack

const cloneStacks = (stacks: readonly InventoryStack[]): InventoryStack[] => stacks.map(cloneStack)

const mergeStacks = (stacks: InventoryStack[]): InventoryStack[] => {
  const map = new Map<string, number>()
  for (const stack of stacks) {
    const quantity = normalizeQuantity(stack.quantity)
    if (quantity <= 0) {
      continue
    } // end if stack is empty
    map.set(stack.itemId, (map.get(stack.itemId) ?? 0) + quantity)
  } // end for each stack
  return Array.from(map.entries())
    .map(([itemId, quantity]) => ({ itemId, quantity }))
    .sort((left, right) => left.itemId.localeCompare(right.itemId))
} // end function mergeStacks

const removeQuantityFromStacks = (
  stacks: InventoryStack[],
  itemId: string,
  requestedQuantity: number
): { removedQuantity: number; nextStacks: InventoryStack[] } => {
  const quantity = normalizeQuantity(requestedQuantity)
  if (quantity <= 0) {
    return { removedQuantity: 0, nextStacks: mergeStacks(stacks) }
  } // end if requested quantity invalid

  const nextStacks = mergeStacks(stacks)
  const targetStack = nextStacks.find((stack) => stack.itemId === itemId)
  if (!targetStack) {
    return { removedQuantity: 0, nextStacks }
  } // end if item not in container

  const removedQuantity = Math.min(targetStack.quantity, quantity)
  targetStack.quantity -= removedQuantity
  return {
    removedQuantity,
    nextStacks: nextStacks.filter((stack) => stack.quantity > 0)
  }
} // end function removeQuantityFromStacks

const transferStacksToInventory = (inventory: InventoryManager, stacks: readonly InventoryStack[]): InventoryStack[] => {
  const merged = mergeStacks(cloneStacks(stacks))
  for (const stack of merged) {
    inventory.addItem(stack.itemId, stack.quantity)
  } // end for each stack transfer
  return merged
} // end function transferStacksToInventory

class RuntimePickupSystem implements PickupSystem {
  private readonly inventory: InventoryManager
  private readonly itemDatabase: ItemDatabase
  private readonly lootGenerator: LootGenerator
  private readonly interactionKeyLabel: string
  private readonly loosePickups = new Map<string, LoosePickup>()
  private readonly containers = new Map<string, LootContainerPickup>()
  private idCounter = 1

  constructor(options: PickupSystemOptions) {
    this.inventory = options.inventory
    this.itemDatabase = options.itemDatabase
    this.lootGenerator = options.lootGenerator
    this.interactionKeyLabel = options.interactionKeyLabel?.trim() || 'E'
  } // end constructor

  spawnLoosePickup(options: SpawnLoosePickupOptions): LoosePickup {
    const quantity = normalizeQuantity(options.quantity)
    if (quantity <= 0) {
      throw new Error('Loose pickup quantity must be greater than zero.')
    } // end if loose pickup quantity invalid
    if (!this.itemDatabase.has(options.itemId)) {
      throw new Error(`Unknown itemId: ${options.itemId}`)
    } // end if unknown loose pickup item

    const id = `pickup-loose-${this.idCounter++}`
    const pickup: LoosePickup = {
      id,
      createdAtMs: Date.now(),
      position: {
        x: toFiniteNumber(options.position.x, 0),
        y: toFiniteNumber(options.position.y, 0),
        z: toFiniteNumber(options.position.z, 0)
      },
      interactionRadius: Math.max(0.1, toFiniteNumber(options.interactionRadius ?? DEFAULT_INTERACTION_RADIUS, DEFAULT_INTERACTION_RADIUS)),
      stack: {
        itemId: options.itemId,
        quantity
      },
      autoPickup: options.autoPickup ?? false,
      label: options.label?.trim() || undefined
    }
    this.loosePickups.set(id, pickup)
    return { ...pickup, stack: cloneStack(pickup.stack) }
  } // end method spawnLoosePickup

  spawnContainer(options: SpawnContainerOptions): LootContainerPickup {
    const id = `pickup-container-${this.idCounter++}`
    const items = mergeStacks(cloneStacks(options.items).filter((stack) => this.itemDatabase.has(stack.itemId)))
    const container: LootContainerPickup = {
      id,
      createdAtMs: Date.now(),
      type: options.type ?? 'container',
      origin: options.origin ?? 'runtime',
      name: options.name,
      position: {
        x: toFiniteNumber(options.position.x, 0),
        y: toFiniteNumber(options.position.y, 0),
        z: toFiniteNumber(options.position.z, 0)
      },
      interactionRadius: Math.max(0.1, toFiniteNumber(options.interactionRadius ?? DEFAULT_INTERACTION_RADIUS, DEFAULT_INTERACTION_RADIUS)),
      items,
      rarityPriority: Math.max(0, toFiniteNumber(options.rarityPriority ?? 0, 0)),
      isPersistent: options.isPersistent ?? false,
      autoRemoveWhenEmpty: options.autoRemoveWhenEmpty ?? true,
      audioCueId: options.audioCueId
    }
    this.containers.set(id, container)
    return { ...container, items: cloneStacks(container.items) }
  } // end method spawnContainer

  spawnContainerFromLootTable(options: SpawnContainerFromLootTableOptions): LootContainerPickup {
    const generated = this.lootGenerator.generateForContainer(options.tableId)
    return this.spawnContainer({
      position: options.position,
      type: options.type ?? 'container',
      origin: options.origin ?? 'runtime',
      name: options.name ?? generated.tableId,
      items: generated.stacks,
      rarityPriority: options.rarityPriority,
      isPersistent: options.isPersistent,
      autoRemoveWhenEmpty: options.autoRemoveWhenEmpty,
      interactionRadius: options.interactionRadius,
      audioCueId: options.audioCueId
    })
  } // end method spawnContainerFromLootTable

  spawnWreckFromEntityLoot(options: SpawnContainerFromLootTableOptions): LootContainerPickup {
    const generated = this.lootGenerator.generateForEntity(options.tableId)
    return this.spawnContainer({
      position: options.position,
      type: options.type ?? 'wreck',
      origin: options.origin ?? 'runtime',
      name: options.name ?? `Wreck: ${generated.tableId}`,
      items: generated.stacks,
      rarityPriority: options.rarityPriority,
      isPersistent: options.isPersistent,
      autoRemoveWhenEmpty: options.autoRemoveWhenEmpty,
      interactionRadius: options.interactionRadius,
      audioCueId: options.audioCueId
    })
  } // end method spawnWreckFromEntityLoot

  updatePlayerPresence(playerPosition: PickupPosition): PickupUpdateResult {
    const autoCollected: InventoryStack[] = []

    for (const [id, pickup] of this.loosePickups.entries()) {
      if (!pickup.autoPickup) {
        continue
      } // end if loose pickup requires manual interaction
      const radius = Math.max(0.1, pickup.interactionRadius)
      if (distanceSquared(playerPosition, pickup.position) > radius * radius) {
        continue
      } // end if player is outside pickup range

      this.inventory.addItem(pickup.stack.itemId, pickup.stack.quantity)
      autoCollected.push(cloneStack(pickup.stack))
      this.loosePickups.delete(id)
    } // end for each auto pickup

    return {
      autoCollected: mergeStacks(autoCollected),
      prompt: this.getPrompt(playerPosition)
    }
  } // end method updatePlayerPresence

  getPrompt(playerPosition: PickupPosition): PickupPrompt | null {
    const nearestLoose = this.getNearestManualLoosePickup(playerPosition)
    const nearestContainer = this.getNearestContainer(playerPosition)
    const nearest = this.pickNearestInteractionTarget(nearestLoose, nearestContainer)
    if (!nearest) {
      return null
    } // end if no interaction target

    if (nearest.kind === 'loose') {
      const definition = this.itemDatabase.getById(nearest.pickup.stack.itemId)
      const label = nearest.pickup.label ?? definition?.name ?? nearest.pickup.stack.itemId
      const text = `Press ${this.interactionKeyLabel} to pick up ${label} x${nearest.pickup.stack.quantity}`
      return {
        id: nearest.pickup.id,
        text,
        accessibilityText: `${text}. Manual pickup.`
      }
    } // end if nearest target is loose pickup

    const stackCount = nearest.container.items.length
    const text = `Press ${this.interactionKeyLabel} to loot ${nearest.container.name} (${stackCount} stacks)`
    return {
      id: nearest.container.id,
      text,
      accessibilityText: `${text}. ${nearest.container.type} container.`
    }
  } // end method getPrompt

  interactNearest(playerPosition: PickupPosition): PickupCollectResult | null {
    const nearestLoose = this.getNearestManualLoosePickup(playerPosition)
    const nearestContainer = this.getNearestContainer(playerPosition)
    const nearest = this.pickNearestInteractionTarget(nearestLoose, nearestContainer)
    if (!nearest) {
      return null
    } // end if no interaction target found

    if (nearest.kind === 'loose') {
      this.loosePickups.delete(nearest.pickup.id)
      const collected = transferStacksToInventory(this.inventory, [nearest.pickup.stack])
      return {
        sourceId: nearest.pickup.id,
        sourceType: 'loose',
        collected
      }
    } // end if interacting with loose pickup

    const lootResult = this.lootContainerAll(nearest.container.id)
    const collected = lootResult?.collected ?? []
    return {
      sourceId: nearest.container.id,
      sourceType: nearest.container.type,
      collected
    }
  } // end method interactNearest

  lootContainerItem(containerId: string, itemId: string, quantity: number): ContainerLootResult | null {
    const container = this.containers.get(containerId)
    if (!container) {
      return null
    } // end if container not found
    if (!this.itemDatabase.has(itemId)) {
      return null
    } // end if item id unknown

    const removal = removeQuantityFromStacks(container.items, itemId, quantity)
    if (removal.removedQuantity <= 0) {
      return {
        containerId: container.id,
        sourceType: container.type,
        collected: [],
        remainingStacks: cloneStacks(container.items),
        removed: false
      }
    } // end if nothing removed from container

    const collected = transferStacksToInventory(this.inventory, [{ itemId, quantity: removal.removedQuantity }])
    container.items = removal.nextStacks
    const removed = container.items.length <= 0 && container.autoRemoveWhenEmpty
    if (removed) {
      this.containers.delete(container.id)
    }

    return {
      containerId: container.id,
      sourceType: container.type,
      collected,
      remainingStacks: removed ? [] : cloneStacks(container.items),
      removed
    }
  } // end method lootContainerItem

  lootContainerAll(containerId: string): ContainerLootResult | null {
    const container = this.containers.get(containerId)
    if (!container) {
      return null
    } // end if container not found

    const collected = transferStacksToInventory(this.inventory, container.items)
    container.items = []
    const removed = container.autoRemoveWhenEmpty
    if (removed) {
      this.containers.delete(container.id)
    }

    return {
      containerId: container.id,
      sourceType: container.type,
      collected,
      remainingStacks: removed ? [] : [],
      removed
    }
  } // end method lootContainerAll

  getContainer(containerId: string): LootContainerPickup | null {
    const container = this.containers.get(containerId)
    if (!container) {
      return null
    } // end if container is missing
    return { ...container, items: cloneStacks(container.items) }
  } // end method getContainer

  removeLoosePickup(pickupId: string): boolean {
    return this.loosePickups.delete(pickupId)
  } // end method removeLoosePickup

  removeContainer(containerId: string): boolean {
    return this.containers.delete(containerId)
  } // end method removeContainer

  listLoosePickups(): LoosePickup[] {
    return Array.from(this.loosePickups.values())
      .map((pickup) => ({ ...pickup, stack: cloneStack(pickup.stack) }))
      .sort((left, right) => left.id.localeCompare(right.id))
  } // end method listLoosePickups

  listContainers(): LootContainerPickup[] {
    return Array.from(this.containers.values())
      .map((container) => ({ ...container, items: cloneStacks(container.items) }))
      .sort((left, right) => left.id.localeCompare(right.id))
  } // end method listContainers

  clearAll(): void {
    this.loosePickups.clear()
    this.containers.clear()
  } // end method clearAll

  private getNearestManualLoosePickup(playerPosition: PickupPosition): { kind: 'loose'; distanceSq: number; pickup: LoosePickup } | null {
    let nearest: { kind: 'loose'; distanceSq: number; pickup: LoosePickup } | null = null

    for (const pickup of this.loosePickups.values()) {
      if (pickup.autoPickup) {
        continue
      } // end if pickup is auto only
      const radius = Math.max(0.1, pickup.interactionRadius)
      const distSq = distanceSquared(playerPosition, pickup.position)
      if (distSq > radius * radius) {
        continue
      } // end if outside interaction radius
      if (!nearest || distSq < nearest.distanceSq) {
        nearest = { kind: 'loose', distanceSq: distSq, pickup }
      } // end if nearest loose pickup updated
    } // end for each loose pickup

    return nearest
  } // end method getNearestManualLoosePickup

  private getNearestContainer(playerPosition: PickupPosition): { kind: 'container'; distanceSq: number; container: LootContainerPickup } | null {
    let nearest: { kind: 'container'; distanceSq: number; container: LootContainerPickup } | null = null

    for (const container of this.containers.values()) {
      if (container.items.length <= 0) {
        continue
      } // end if container is empty
      const radius = Math.max(0.1, container.interactionRadius)
      const distSq = distanceSquared(playerPosition, container.position)
      if (distSq > radius * radius) {
        continue
      } // end if outside container interaction radius
      if (!nearest || distSq < nearest.distanceSq) {
        nearest = { kind: 'container', distanceSq: distSq, container }
      } // end if nearest container updated
    } // end for each container

    return nearest
  } // end method getNearestContainer

  private pickNearestInteractionTarget(
    loose: { kind: 'loose'; distanceSq: number; pickup: LoosePickup } | null,
    container: { kind: 'container'; distanceSq: number; container: LootContainerPickup } | null
  ): { kind: 'loose'; distanceSq: number; pickup: LoosePickup } | { kind: 'container'; distanceSq: number; container: LootContainerPickup } | null {
    if (!loose) {
      return container
    } // end if no loose candidate exists
    if (!container) {
      return loose
    } // end if no container candidate exists
    return loose.distanceSq <= container.distanceSq ? loose : container
  } // end method pickNearestInteractionTarget
} // end class RuntimePickupSystem

export const createPickupSystem = (options: PickupSystemOptions): PickupSystem => {
  return new RuntimePickupSystem(options)
} // end function createPickupSystem
