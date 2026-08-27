import type { InventoryStack } from '../../data/items/types.js'
import type { ItemDatabase } from '../inventory/itemDatabase.js'
import type { LootEntry, LootRollResult, LootTable, LootTableRegistry } from '../../data/lootTables/types.js'

export interface LootGeneratorOptions {
  itemDatabase: ItemDatabase
  lootTables: LootTableRegistry
  random?: () => number
} // end interface LootGeneratorOptions

export interface LootGenerator {
  generateFromEntries(entries: readonly LootEntry[]): InventoryStack[]
  generateForEntity(entityLootTableId: string): LootRollResult
  generateForContainer(containerLootTableId: string): LootRollResult
} // end interface LootGenerator

const clampDropChance = (dropChance: number): number => {
  if (!Number.isFinite(dropChance)) {
    return 0
  } // end if drop chance invalid
  return Math.max(0, Math.min(1, dropChance))
} // end function clampDropChance

const normalizeQuantityBound = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  } // end if invalid quantity bound
  return Math.max(0, Math.floor(value))
} // end function normalizeQuantityBound

const randomIntInclusive = (min: number, max: number, random: () => number): number => {
  const normalizedMin = normalizeQuantityBound(min)
  const normalizedMax = normalizeQuantityBound(max)
  const lower = Math.min(normalizedMin, normalizedMax)
  const upper = Math.max(normalizedMin, normalizedMax)

  if (upper <= lower) {
    return lower
  } // end if degenerate range

  const sample = Math.max(0, Math.min(1 - Number.EPSILON, random()))
  const span = upper - lower + 1
  return lower + Math.floor(sample * span)
} // end function randomIntInclusive

const mergeStack = (stacks: InventoryStack[], itemId: string, quantity: number): void => {
  if (quantity <= 0) {
    return
  } // end if no quantity

  const existing = stacks.find((stack) => stack.itemId === itemId)
  if (existing) {
    existing.quantity += quantity
    return
  } // end if merged into existing stack

  stacks.push({ itemId, quantity })
} // end function mergeStack

class RuntimeLootGenerator implements LootGenerator {
  private readonly itemDatabase: ItemDatabase
  private readonly lootTables: LootTableRegistry
  private readonly random: () => number

  constructor(options: LootGeneratorOptions) {
    this.itemDatabase = options.itemDatabase
    this.lootTables = options.lootTables
    this.random = options.random ?? Math.random
  } // end constructor

  generateFromEntries(entries: readonly LootEntry[]): InventoryStack[] {
    const generated: InventoryStack[] = []

    for (const entry of entries) {
      if (!this.itemDatabase.has(entry.itemId)) {
        continue
      } // end if unknown item id

      const chance = clampDropChance(entry.dropChance)
      if (this.random() > chance) {
        continue
      } // end if drop roll failed

      const quantity = randomIntInclusive(entry.minQuantity, entry.maxQuantity, this.random)
      mergeStack(generated, entry.itemId, quantity)
    } // end for each loot entry

    generated.sort((left, right) => left.itemId.localeCompare(right.itemId))
    return generated
  } // end method generateFromEntries

  generateForEntity(entityLootTableId: string): LootRollResult {
    const table = this.lootTables.entity[entityLootTableId]
    if (!table) {
      return {
        tableId: entityLootTableId,
        stacks: []
      }
    } // end if entity table missing

    return {
      tableId: table.id,
      stacks: this.generateFromEntries(table.entries)
    }
  } // end method generateForEntity

  generateForContainer(containerLootTableId: string): LootRollResult {
    const table = this.lootTables.container[containerLootTableId]
    if (!table) {
      return {
        tableId: containerLootTableId,
        stacks: []
      }
    } // end if container table missing

    return {
      tableId: table.id,
      stacks: this.generateFromEntries(table.entries)
    }
  } // end method generateForContainer
} // end class RuntimeLootGenerator

export const createLootGenerator = (options: LootGeneratorOptions): LootGenerator => {
  return new RuntimeLootGenerator(options)
} // end function createLootGenerator

export const getLootTableById = (
  lootTables: LootTableRegistry,
  scope: 'entity' | 'container',
  tableId: string
): LootTable | null => {
  return lootTables[scope][tableId] ?? null
} // end function getLootTableById
