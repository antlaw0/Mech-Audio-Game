import assert from 'node:assert/strict'
import test from 'node:test'

import type { ItemDefinition } from '../packages/client/src/data/items/types.js'
import type { LootTableRegistry } from '../packages/client/src/data/lootTables/types.js'
import { createItemDatabase } from '../packages/client/src/systems/inventory/itemDatabase.js'
import { createLootGenerator } from '../packages/client/src/systems/loot/lootGenerator.js'

const definitions: ItemDefinition[] = [
  { id: 'ammo', name: 'Ammo', description: 'Ammo.', category: 'supplies', rarity: 1, weightPerUnit: 1, value: 1, maxStackSize: 10 },
  { id: 'scrap', name: 'Scrap', description: 'Scrap.', category: 'resources', rarity: 1, weightPerUnit: 1, value: 1, maxStackSize: 10 }
]

const tables: LootTableRegistry = {
  entity: {
    enemy: {
      id: 'enemy',
      entries: [
        { itemId: 'scrap', minQuantity: 1, maxQuantity: 3, dropChance: 1 },
        { itemId: 'ammo', minQuantity: 2, maxQuantity: 2, dropChance: 0.5 },
        { itemId: 'scrap', minQuantity: 2, maxQuantity: 2, dropChance: 1 },
        { itemId: 'missing', minQuantity: 9, maxQuantity: 9, dropChance: 1 }
      ]
    }
  },
  container: {}
}

test('loot generation is repeatable with an injected random sequence', () => {
  const samples = [0, 0, 0.75, 0, 0]
  let index = 0
  const generator = createLootGenerator({
    itemDatabase: createItemDatabase(definitions),
    lootTables: tables,
    random: () => samples[index++] ?? 0
  })

  assert.deepEqual(generator.generateForEntity('enemy'), {
    tableId: 'enemy',
    stacks: [{ itemId: 'scrap', quantity: 3 }]
  })
} // end test deterministic loot generation
)

test('missing loot table returns an empty result with requested ID', () => {
  const generator = createLootGenerator({
    itemDatabase: createItemDatabase(definitions),
    lootTables: tables,
    random: () => 0
  })

  assert.deepEqual(generator.generateForContainer('missing'), { tableId: 'missing', stacks: [] })
} // end test missing loot table
)
