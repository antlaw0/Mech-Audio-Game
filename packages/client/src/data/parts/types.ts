export const PART_CATEGORIES = [
  'Head',
  'Computer',
  'Core',
  'Generator',
  'ThermalRegulator',
  'LeftArm',
  'RightArm',
  'Utility1',
  'Utility2',
  'GroundMobility',
  'Chip',
  'HandWeapon',
  'ShoulderWeapon'
] as const

export type PartCategory = typeof PART_CATEGORIES[number]

export type PartModifier = {
  id: string
  type: 'stat_mult' | 'stat_add' | 'special'
  stat: string
  value: number
}

export const PART_EFFECT_TARGETS = [
  'energyRegenPerSecond',
  'activeEnergyDrainPerSecond',
  'coolingPerSecond',
  'turnRate',
  'projectileSpreadDegrees',
  'weaponDamageBallistic',
  'weaponDamageEnergy',
  'weaponDamageMissile',
  'weaponDamageMelee'
] as const

export type PartEffectTarget = typeof PART_EFFECT_TARGETS[number]

export type PartEffectCondition = {
  epPercentGte?: number
  epPercentLte?: number
  heatPercentGte?: number
  heatPercentLte?: number
  isFlying?: boolean
  isMoving?: boolean
  isStandingStill?: boolean
  weaponTypeIn?: Array<'ballistic' | 'energy' | 'missile'>
  targetEnemyTypeIn?: string[]
}

export type PartEffectModifier = {
  id: string
  target: PartEffectTarget
  op: 'add' | 'mult'
  value: number
  conditions?: PartEffectCondition
  description?: string
}

export type PartVariantStatModifier =
  | { op: 'add'; value: number }
  | { op: 'mult'; value: number }
  | { op: 'replace'; value: number }

export type PartVariantStatModifierInput =
  | PartVariantStatModifier
  | { add: number }
  | { mult: number }
  | { replace: number }

export type PartDefinition = {
  id: string
  name: string
  category: PartCategory
  variantOf?: string
  statModifiers?: Record<string, PartVariantStatModifierInput>
  integrity: number
  armorValue: number
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
  heatCapacity?: number
  emergencyCooling?: number
  liftCapacity?: number
  flightType?: string
  rotorCount?: number
  verticalTakeoffTime?: number
  flightStability?: number
  speedModifier?: number
  groundCapacity: number
  energyUse?: number
  range?: number
  lockOn?: number
  stability?: number
  meleeDamage?: number
  accuracy?: number
  sensorStrength?: number
  twoHanded?: boolean
  isMelee?: boolean
  isPassive?: boolean
  damagePerShot?: number
  fireRateCooldownSeconds?: number
  projectileCount?: number
  projectileType?: string
  spreadDegrees?: number
  bulletSpeed?: number
  clipSize?: number
  weaponReach?: number
  meleeContactTimeMs?: number
  fireSound?: string
  meleeHitSound?: string
  reloadSound?: string
  damageType?: string
  firingMode?: 'fullauto' | 'semiauto'
  horizontalLockAngle?: number
  verticalLockAngle?: number
  effectiveRange?: number
  ammoConsumedPerShot?: number
  energyPerShot?: number
  chipSlots?: number
  computeBandWidth?: number
  chipMemoryCost?: number
  chipModifiers?: string[]
  effectModifiers?: PartEffectModifier[]
}

export type InstalledChipState = {
  chipInstanceId: string
  active: boolean
}

export type PartInstance = {
  instanceId: string
  definitionId: string
  currentIntegrity: number
  modifiers: PartModifier[]
  installedChips: InstalledChipState[]
  rngSeed: number
}

export type ResolvedInstalledChip = {
  chipInstanceId: string
  chipDefinitionId: string
  chipName: string
  memoryCost: number
  modifiers: string[]
  active: boolean
  supportedByCompute: boolean
}

export type MechLoadout = {
  Head?: string
  Computer?: string
  Core?: string
  Generator?: string
  ThermalRegulator?: string
  LeftArm?: string
  RightArm?: string
  Utility1?: string
  Utility2?: string
  GroundMobility?: string
  LeftHand?: string
  RightHand?: string
  ShoulderLeft?: string
  ShoulderRight?: string
}

export type WeaponMountSlot = 'LeftHand' | 'RightHand' | 'ShoulderLeft' | 'ShoulderRight'

export const WEAPON_MOUNT_SLOTS: readonly WeaponMountSlot[] = ['LeftHand', 'RightHand', 'ShoulderLeft', 'ShoulderRight']

export const WEAPON_MOUNT_SLOT_LABELS: Record<WeaponMountSlot, string> = {
  LeftHand: 'Left Hand',
  RightHand: 'Right Hand',
  ShoulderLeft: 'Left Shoulder',
  ShoulderRight: 'Right Shoulder'
}

export type ResolvedPartStats = PartDefinition & {
  instanceId?: string
  currentIntegrity: number
  integrityRatio: number
  damagePenaltyMultiplier: number
  modifierSummary: string[]
  installedChips: string[]
  installedChipStates: ResolvedInstalledChip[]
  chipSlotCount: number
  chipComputeUsed: number
  chipComputeCapacity: number
}

export type GarageSnapshot = {
  catalog: PartDefinition[]
  inventory: PartInstance[]
  loadout: MechLoadout
  devModeEnabled: boolean
}

export const PART_DEFINITION_NUMERIC_KEYS = [
  'integrity',
  'armorValue',
  'weight',
  'PDEF',
  'EDEF',
  'energyDrain',
  'energyCapacity',
  'powerOutput',
  'heatGeneration',
  'heatDissipation',
  'heatCapacity',
  'emergencyCooling',
  'liftCapacity',
  'rotorCount',
  'verticalTakeoffTime',
  'flightStability',
  'speedModifier',
  'groundCapacity',
  'energyUse',
  'range',
  'lockOn',
  'stability',
  'meleeDamage',
  'accuracy',
  'sensorStrength',
  'damagePerShot',
  'fireRateCooldownSeconds',
  'projectileCount',
  'spreadDegrees',
  'bulletSpeed',
  'clipSize',
  'weaponReach',
  'meleeContactTimeMs',
  'horizontalLockAngle',
  'verticalLockAngle',
  'effectiveRange',
  'ammoConsumedPerShot',
  'energyPerShot',
  'chipSlots',
  'computeBandWidth',
  'chipMemoryCost'
] as const

export type PartNumericKey = typeof PART_DEFINITION_NUMERIC_KEYS[number]

export const CATEGORY_LABELS: Record<PartCategory, string> = {
  Head: 'Head',
  Computer: 'Computer',
  Core: 'Core',
  Generator: 'Generator',
  ThermalRegulator: 'Thermal Regulator',
  LeftArm: 'Left Arm',
  RightArm: 'Right Arm',
  Utility1: 'Utility 1',
  Utility2: 'Utility 2',
  GroundMobility: 'Ground Mobility',
  Chip: 'Chips',
  HandWeapon: 'Hand Weapon',
  ShoulderWeapon: 'Shoulder Weapon'
}
