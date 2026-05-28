import type { InventoryStack, ItemCategory } from '../../data/items/types.js'
import type { ItemDatabase } from './itemDatabase.js'

export interface InventoryManager {
  addItem(itemId: string, quantity: number): number
  removeItem(itemId: string, quantity: number): number
  hasItem(itemId: string, quantity?: number): boolean
  getQuantity(itemId: string): number
  getCargoWeight(): number
  getItemsByCategory(category: ItemCategory): InventoryStack[]
  dropItem(itemId: string, quantity: number): InventoryStack | null
  transferItem(target: InventoryManager, itemId: string, quantity: number): number
  getStacks(): InventoryStack[]
} // end interface InventoryManager

const normalizeQuantity = (quantity: number): number => {
  if (!Number.isFinite(quantity)) {
    return 0
  } // end if invalid quantity
  return Math.max(0, Math.floor(quantity))
} // end function normalizeQuantity

class RuntimeInventoryManager implements InventoryManager {
  private readonly itemDatabase: ItemDatabase
  private readonly stackQuantities = new Map<string, number>()

  constructor(itemDatabase: ItemDatabase) {
    this.itemDatabase = itemDatabase
  } // end constructor

  addItem(itemId: string, quantity: number): number {
    const normalizedQuantity = normalizeQuantity(quantity)
    if (normalizedQuantity <= 0) {
      return this.getQuantity(itemId)
    } // end if no-op add

    if (!this.itemDatabase.has(itemId)) {
      throw new Error(`Cannot add unknown itemId: ${itemId}`)
    } // end if unknown item

    const nextQuantity = this.getQuantity(itemId) + normalizedQuantity
    this.stackQuantities.set(itemId, nextQuantity)
    return nextQuantity
  } // end method addItem

  removeItem(itemId: string, quantity: number): number {
    const normalizedQuantity = normalizeQuantity(quantity)
    if (normalizedQuantity <= 0) {
      return this.getQuantity(itemId)
    } // end if no-op remove

    const currentQuantity = this.getQuantity(itemId)
    const nextQuantity = Math.max(0, currentQuantity - normalizedQuantity)
    if (nextQuantity <= 0) {
      this.stackQuantities.delete(itemId)
      return 0
    } // end if stack depleted

    this.stackQuantities.set(itemId, nextQuantity)
    return nextQuantity
  } // end method removeItem

  hasItem(itemId: string, quantity = 1): boolean {
    const normalizedQuantity = Math.max(1, normalizeQuantity(quantity))
    return this.getQuantity(itemId) >= normalizedQuantity
  } // end method hasItem

  getQuantity(itemId: string): number {
    return this.stackQuantities.get(itemId) ?? 0
  } // end method getQuantity

  getCargoWeight(): number {
    let totalWeight = 0
    for (const [itemId, quantity] of this.stackQuantities.entries()) {
      if (quantity <= 0) {
        continue
      } // end if invalid runtime stack
      const definition = this.itemDatabase.getById(itemId)
      if (!definition) {
        continue
      } // end if missing definition
      totalWeight += quantity * definition.weightPerUnit
    } // end for each stack
    return Number(totalWeight.toFixed(4))
  } // end method getCargoWeight

  getItemsByCategory(category: ItemCategory): InventoryStack[] {
    const stacks: InventoryStack[] = []
    for (const [itemId, quantity] of this.stackQuantities.entries()) {
      if (quantity <= 0) {
        continue
      } // end if invalid quantity
      const definition = this.itemDatabase.getById(itemId)
      if (!definition || definition.category !== category) {
        continue
      } // end if category mismatch
      stacks.push({ itemId, quantity })
    } // end for each stack

    stacks.sort((left, right) => left.itemId.localeCompare(right.itemId))
    return stacks
  } // end method getItemsByCategory

  dropItem(itemId: string, quantity: number): InventoryStack | null {
    const normalizedQuantity = normalizeQuantity(quantity)
    if (normalizedQuantity <= 0) {
      return null
    } // end if no-op drop

    const currentQuantity = this.getQuantity(itemId)
    const droppedQuantity = Math.min(currentQuantity, normalizedQuantity)
    if (droppedQuantity <= 0) {
      return null
    } // end if nothing dropped

    this.removeItem(itemId, droppedQuantity)
    return {
      itemId,
      quantity: droppedQuantity
    }
  } // end method dropItem

  transferItem(target: InventoryManager, itemId: string, quantity: number): number {
    const normalizedQuantity = normalizeQuantity(quantity)
    if (normalizedQuantity <= 0) {
      return 0
    } // end if no-op transfer

    const removedBefore = this.getQuantity(itemId)
    const drop = this.dropItem(itemId, normalizedQuantity)
    if (!drop) {
      return 0
    } // end if source had nothing

    target.addItem(drop.itemId, drop.quantity)
    return Math.max(0, removedBefore - this.getQuantity(itemId))
  } // end method transferItem

  getStacks(): InventoryStack[] {
    const stacks: InventoryStack[] = []
    for (const [itemId, quantity] of this.stackQuantities.entries()) {
      if (quantity <= 0) {
        continue
      } // end if invalid quantity
      stacks.push({ itemId, quantity })
    } // end for each stack

    stacks.sort((left, right) => left.itemId.localeCompare(right.itemId))
    return stacks
  } // end method getStacks
} // end class RuntimeInventoryManager

export const createInventoryManager = (options: { itemDatabase: ItemDatabase }): InventoryManager => {
  return new RuntimeInventoryManager(options.itemDatabase)
} // end function createInventoryManager
