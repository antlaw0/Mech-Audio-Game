export const PART_CATEGORIES = [
  'Head',
  'Computer',
  'Core',
  'Generator',
  'LeftArm',
  'RightArm',
  'Utility1',
  'Utility2'
] as const

export type PartCategory = typeof PART_CATEGORIES[number]

export type PartModifier = {
  id: string
  type: 'stat_mult' | 'stat_add' | 'special'
  stat: string
  value: number
}

export type PartDefinition = {
  id: string
  name: string
  category: PartCategory
  integrity: number
  weight: number
  PDEF: number
  EDEF: number
  energyDrain: number
  deprecated?: boolean
  passiveBonuses?: string[]
  activeAbilities?: string[]
  specialEffects?: string[]
  energyCapacity?: number
  idleEnergyRegen?: number
  movingEnergyRegen?: number
  flyingEnergyRegen?: number
  regenDelay?: number
  powerOutput?: number
  heatGeneration?: number
  heatDissipation?: number
  liftCapacity?: number
  flightType?: string
  rotorCount?: number
  verticalTakeoffTime?: number
  flightStability?: number
  speedModifier?: number
  energyUse?: number
  range?: number
  lockOn?: number
  stability?: number
  meleePower?: number
  accuracy?: number
  sensorStrength?: number
}

export type PartInstance = {
  instanceId: string
  definitionId: string
  currentIntegrity: number
  modifiers: PartModifier[]
  installedChips: string[]
  rngSeed: number
}

export type MechLoadout = {
  Head?: string
  Computer?: string
  Core?: string
  Generator?: string
  LeftArm?: string
  RightArm?: string
  Utility1?: string
  Utility2?: string
}

export type ResolvedPartStats = PartDefinition & {
  instanceId?: string
  currentIntegrity: number
  integrityRatio: number
  damagePenaltyMultiplier: number
  modifierSummary: string[]
  installedChips: string[]
}

export type GarageSnapshot = {
  catalog: PartDefinition[]
  inventory: PartInstance[]
  loadout: MechLoadout
  devModeEnabled: boolean
}

export const PART_DEFINITION_NUMERIC_KEYS = [
  'integrity',
  'weight',
  'PDEF',
  'EDEF',
  'energyDrain',
  'energyCapacity',
  'powerOutput',
  'heatGeneration',
  'heatDissipation',
  'liftCapacity',
  'rotorCount',
  'verticalTakeoffTime',
  'flightStability',
  'speedModifier',
  'energyUse',
  'range',
  'lockOn',
  'stability',
  'meleePower',
  'accuracy',
  'sensorStrength'
] as const

export type PartNumericKey = typeof PART_DEFINITION_NUMERIC_KEYS[number]

export const CATEGORY_LABELS: Record<PartCategory, string> = {
  Head: 'Head',
  Computer: 'Computer',
  Core: 'Core',
  Generator: 'Generator',
  LeftArm: 'Left Arm',
  RightArm: 'Right Arm',
  Utility1: 'Utility 1',
  Utility2: 'Utility 2'
}
