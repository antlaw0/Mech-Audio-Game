import type { LootTableRegistry } from './types.js'

const createLootTableRegistry = (): LootTableRegistry => {
  return {
    entity: {
      raider_basic: {
        id: 'raider_basic',
        entries: [
          { itemId: 'ammo_resource', minQuantity: 12, maxQuantity: 40, dropChance: 0.9 },
          { itemId: 'scrap_metal', minQuantity: 2, maxQuantity: 10, dropChance: 0.75 },
          { itemId: 'repair_kit', minQuantity: 1, maxQuantity: 1, dropChance: 0.18 }
        ]
      },
      science_patrol: {
        id: 'science_patrol',
        entries: [
          { itemId: 'energy_cell', minQuantity: 1, maxQuantity: 4, dropChance: 0.8 },
          { itemId: 'electronics', minQuantity: 2, maxQuantity: 8, dropChance: 0.68 },
          { itemId: 'composite_plating', minQuantity: 1, maxQuantity: 3, dropChance: 0.24 }
        ]
      },
      industrial_guard: {
        id: 'industrial_guard',
        entries: [
          { itemId: 'scrap_metal', minQuantity: 8, maxQuantity: 28, dropChance: 0.92 },
          { itemId: 'composite_plating', minQuantity: 1, maxQuantity: 4, dropChance: 0.5 },
          { itemId: 'electronics', minQuantity: 1, maxQuantity: 6, dropChance: 0.45 }
        ]
      }
    },
    container: {
      supply_crate_common: {
        id: 'supply_crate_common',
        entries: [
          { itemId: 'ammo_resource', minQuantity: 20, maxQuantity: 80, dropChance: 0.85 },
          { itemId: 'energy_cell', minQuantity: 1, maxQuantity: 5, dropChance: 0.7 },
          { itemId: 'repair_kit', minQuantity: 1, maxQuantity: 2, dropChance: 0.3 }
        ]
      },
      stash_rare_parts: {
        id: 'stash_rare_parts',
        entries: [
          { itemId: 'electronics', minQuantity: 4, maxQuantity: 12, dropChance: 0.88 },
          { itemId: 'composite_plating', minQuantity: 2, maxQuantity: 6, dropChance: 0.8 },
          { itemId: 'spare_computer_mk1', minQuantity: 1, maxQuantity: 1, dropChance: 0.25 },
          { itemId: 'spare_utility2_mk1', minQuantity: 1, maxQuantity: 1, dropChance: 0.18 }
        ]
      },
      mech_wreck_salvage: {
        id: 'mech_wreck_salvage',
        entries: [
          { itemId: 'scrap_metal', minQuantity: 12, maxQuantity: 48, dropChance: 0.98 },
          { itemId: 'electronics', minQuantity: 2, maxQuantity: 10, dropChance: 0.7 },
          { itemId: 'composite_plating', minQuantity: 1, maxQuantity: 5, dropChance: 0.62 },
          { itemId: 'spare_left_arm_mk1', minQuantity: 1, maxQuantity: 1, dropChance: 0.12 }
        ]
      }
    }
  }
} // end function createLootTableRegistry

export const DEFAULT_LOOT_TABLES: LootTableRegistry = createLootTableRegistry()
