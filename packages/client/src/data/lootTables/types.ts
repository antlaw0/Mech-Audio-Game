import type { InventoryStack } from '../items/types.js'

export interface LootEntry {
  itemId: string
  minQuantity: number
  maxQuantity: number
  dropChance: number
} // end interface LootEntry

export interface LootTable {
  id: string
  entries: readonly LootEntry[]
} // end interface LootTable

export interface LootTableRegistry {
  entity: Readonly<Record<string, LootTable>>
  container: Readonly<Record<string, LootTable>>
} // end interface LootTableRegistry

export interface LootRollResult {
  tableId: string
  stacks: InventoryStack[]
} // end interface LootRollResult
