import assert from 'node:assert/strict'
import test from 'node:test'

import type { ItemDefinition } from '../packages/client/src/data/items/types.js'
import { createInventoryManager } from '../packages/client/src/systems/inventory/inventoryManager.js'
import { createItemDatabase } from '../packages/client/src/systems/inventory/itemDatabase.js'

const definitions: ItemDefinition[] = [
  {
    id: 'ammo',
    name: 'Ammo',
    description: 'Test ammunition.',
    category: 'supplies',
    rarity: 1,
    weightPerUnit: 0.5,
    value: 1,
    maxStackSize: 10
  },
  {
    id: 'scrap',
    name: 'Scrap',
    description: 'Test scrap.',
    category: 'resources',
    rarity: 1,
    weightPerUnit: 2,
    value: 2,
    maxStackSize: 100
  }
]

test('inventory normalizes quantities and rejects unknown items', () => {
  const inventory = createInventoryManager({ itemDatabase: createItemDatabase(definitions) })

  assert.equal(inventory.addItem('ammo', 2.9), 2)
  assert.equal(inventory.addItem('ammo', -4), 2)
  assert.throws(() => inventory.addItem('missing', 1), /unknown itemId/)
} // end test inventory quantity normalization
)

test('inventory reports sorted stacks, category results, and cargo weight', () => {
  const inventory = createInventoryManager({ itemDatabase: createItemDatabase(definitions) })
  inventory.addItem('scrap', 2)
  inventory.addItem('ammo', 4)

  assert.deepEqual(inventory.getStacks(), [
    { itemId: 'ammo', quantity: 4 },
    { itemId: 'scrap', quantity: 2 }
  ])
  assert.deepEqual(inventory.getItemsByCategory('resources'), [{ itemId: 'scrap', quantity: 2 }])
  assert.equal(inventory.getCargoWeight(), 6)
} // end test inventory reporting
)

test('inventory drop and transfer remove only available quantities', () => {
  const database = createItemDatabase(definitions)
  const source = createInventoryManager({ itemDatabase: database })
  const target = createInventoryManager({ itemDatabase: database })
  source.addItem('ammo', 5)

  assert.deepEqual(source.dropItem('ammo', 2), { itemId: 'ammo', quantity: 2 })
  assert.equal(source.transferItem(target, 'ammo', 10), 3)
  assert.equal(source.getQuantity('ammo'), 0)
  assert.equal(target.getQuantity('ammo'), 3)
} // end test inventory drop and transfer
)
