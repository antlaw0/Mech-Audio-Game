export type ItemCategory = 'supplies' | 'resources' | 'parts'

export interface ItemDefinition {
  id: string
  name: string
  description: string
  category: ItemCategory
  rarity: number
  weightPerUnit: number
  value: number
  maxStackSize: number
  iconId?: string
  audioCueId?: string
  flags?: string[]
  useActionId?: string
} // end interface ItemDefinition

export interface InventoryStack {
  itemId: string
  quantity: number
} // end interface InventoryStack
