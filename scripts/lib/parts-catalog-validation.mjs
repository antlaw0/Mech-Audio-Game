const PART_CATEGORIES = new Set([
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
])

const REQUIRED_NUMERIC_KEYS = [
  'integrity',
  'weight',
  'PDEF',
  'EDEF',
  'energyDrain'
]

const OPTIONAL_NUMERIC_KEYS = [
  // Raw authored definitions may omit armorValue; catalog.ts derives it from integrity.
  'armorValue',
  'energyCapacity',
  'idleEnergyRegen',
  'movingEnergyRegen',
  'flyingEnergyRegen',
  'regenDelay',
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
  'ratedLoad',
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
]

const assertFiniteNumber = (definition, key, sourceLabel) => {
  if (typeof definition[key] !== 'number' || !Number.isFinite(definition[key])) {
    throw new Error(`${sourceLabel}: ${definition.id}.${key} must be a finite number.`)
  } // end if invalid numeric field
} // end function assertFiniteNumber

export const validatePartsCatalog = (rawCatalog, sourceLabel = 'parts catalog') => {
  if (!Array.isArray(rawCatalog) || rawCatalog.length === 0) {
    throw new Error(`${sourceLabel}: root value must be a non-empty array.`)
  } // end if invalid catalog root

  const seenIds = new Set()
  for (const [index, definition] of rawCatalog.entries()) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new Error(`${sourceLabel}: entry ${index} must be an object.`)
    } // end if invalid definition object

    if (typeof definition.id !== 'string' || !definition.id.trim()) {
      throw new Error(`${sourceLabel}: entry ${index} must have a non-empty id.`)
    } // end if invalid definition id
    if (seenIds.has(definition.id)) {
      throw new Error(`${sourceLabel}: duplicate part id "${definition.id}".`)
    } // end if duplicate definition id
    seenIds.add(definition.id)

    if (typeof definition.name !== 'string' || !definition.name.trim()) {
      throw new Error(`${sourceLabel}: ${definition.id}.name must be a non-empty string.`)
    } // end if invalid definition name
    if (!PART_CATEGORIES.has(definition.category)) {
      throw new Error(`${sourceLabel}: ${definition.id}.category "${String(definition.category)}" is unsupported.`)
    } // end if unsupported category

    for (const key of REQUIRED_NUMERIC_KEYS) {
      if (typeof definition.variantOf === 'string' && definition[key] === undefined) {
        continue
      } // end if inherited variant field
      assertFiniteNumber(definition, key, sourceLabel)
    } // end for required numeric field

    for (const key of OPTIONAL_NUMERIC_KEYS) {
      if (definition[key] !== undefined) {
        assertFiniteNumber(definition, key, sourceLabel)
      } // end if optional numeric field present
    } // end for optional numeric field

    if (definition.category === 'GroundMobility' && definition.deprecated !== true) {
      if (typeof definition.ratedLoad !== 'number' || !Number.isFinite(definition.ratedLoad) || definition.ratedLoad <= 0) {
        throw new Error(`${sourceLabel}: ${definition.id}.ratedLoad must be a finite number greater than zero.`)
      } // end if invalid ground ratedLoad
    } // end if active ground mobility
  } // end for catalog definition

  return rawCatalog
} // end function validatePartsCatalog
