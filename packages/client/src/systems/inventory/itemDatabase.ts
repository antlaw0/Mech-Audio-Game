import { DEFAULT_ITEM_DEFINITIONS } from '../../data/items/definitions.js'
import type { ItemCategory, ItemDefinition } from '../../data/items/types.js'

const validateDefinition = (definition: ItemDefinition): void => {
  if (!definition.id.trim()) {
    throw new Error('Item definition id must be non-empty.')
  } // end if invalid id

  if (definition.weightPerUnit < 0) {
    throw new Error(`Item definition ${definition.id} has negative weightPerUnit.`)
  } // end if invalid weight

  if (!Number.isFinite(definition.maxStackSize) || definition.maxStackSize < 1) {
    throw new Error(`Item definition ${definition.id} has invalid maxStackSize.`)
  } // end if invalid max stack
} // end function validateDefinition

export interface ItemDatabase {
  getById(itemId: string): ItemDefinition | null
  has(itemId: string): boolean
  list(): readonly ItemDefinition[]
  listByCategory(category: ItemCategory): readonly ItemDefinition[]
} // end interface ItemDatabase

class RuntimeItemDatabase implements ItemDatabase {
  private readonly definitions: readonly ItemDefinition[]
  private readonly byId: ReadonlyMap<string, ItemDefinition>

  constructor(definitions: readonly ItemDefinition[]) {
    const map = new Map<string, ItemDefinition>()

    for (const definition of definitions) {
      validateDefinition(definition)
      if (map.has(definition.id)) {
        throw new Error(`Duplicate item definition id detected: ${definition.id}`)
      } // end if duplicate definition id
      map.set(definition.id, { ...definition, flags: definition.flags ? [...definition.flags] : undefined })
    } // end for each input definition

    this.definitions = Object.freeze(Array.from(map.values()))
    this.byId = map
  } // end constructor

  getById(itemId: string): ItemDefinition | null {
    return this.byId.get(itemId) ?? null
  } // end method getById

  has(itemId: string): boolean {
    return this.byId.has(itemId)
  } // end method has

  list(): readonly ItemDefinition[] {
    return this.definitions
  } // end method list

  listByCategory(category: ItemCategory): readonly ItemDefinition[] {
    return this.definitions.filter((definition) => definition.category === category)
  } // end method listByCategory
} // end class RuntimeItemDatabase

export const createItemDatabase = (definitions: readonly ItemDefinition[]): ItemDatabase => {
  return new RuntimeItemDatabase(definitions)
} // end function createItemDatabase

export const defaultItemDatabase: ItemDatabase = createItemDatabase(DEFAULT_ITEM_DEFINITIONS)
