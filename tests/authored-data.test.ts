import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_ITEM_DEFINITIONS } from '../packages/client/src/data/items/definitions.js'
import { DEFAULT_LOOT_TABLES } from '../packages/client/src/data/lootTables/definitions.js'
import { createItemDatabase } from '../packages/client/src/systems/inventory/itemDatabase.js'

test('authored item definitions create a valid unique database', () => {
  const database = createItemDatabase(DEFAULT_ITEM_DEFINITIONS)

  assert.equal(database.list().length, DEFAULT_ITEM_DEFINITIONS.length)
} // end test authored item definitions
)

test('authored loot tables use valid IDs, items, chances, and quantities', () => {
  const database = createItemDatabase(DEFAULT_ITEM_DEFINITIONS)

  for (const scope of ['entity', 'container'] as const) {
    for (const [registryId, table] of Object.entries(DEFAULT_LOOT_TABLES[scope])) {
      assert.equal(table.id, registryId, `${scope}.${registryId} table id`)
      for (const entry of table.entries) {
        assert.equal(database.has(entry.itemId), true, `${scope}.${registryId} unknown item ${entry.itemId}`)
        assert.equal(Number.isFinite(entry.dropChance), true, `${scope}.${registryId}.${entry.itemId} finite chance`)
        assert.equal(entry.dropChance >= 0 && entry.dropChance <= 1, true, `${scope}.${registryId}.${entry.itemId} chance range`)
        assert.equal(Number.isInteger(entry.minQuantity) && entry.minQuantity >= 0, true, `${scope}.${registryId}.${entry.itemId} minimum quantity`)
        assert.equal(Number.isInteger(entry.maxQuantity) && entry.maxQuantity >= entry.minQuantity, true, `${scope}.${registryId}.${entry.itemId} maximum quantity`)
      } // end for loot entry
    } // end for loot table
  } // end for loot scope
} // end test authored loot tables
)
