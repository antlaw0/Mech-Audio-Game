import { PART_EFFECT_TARGETS, type PartDefinition, type PartEffectCondition, type PartEffectModifier, type PartCategory, type PartInstance, type MechLoadout, type WeaponMountSlot } from './types.js'

const CATALOG_STORAGE_KEY = 'mech.parts.catalog.v1'
const INVENTORY_STORAGE_KEY = 'mech.parts.inventory.v1'
const LOADOUT_STORAGE_KEY = 'mech.parts.loadout.v1'
const DEV_MODE_STORAGE_KEY = 'mech.parts.devMode.v1'

type VariantStatModifier = {
  op: 'add' | 'mult' | 'replace'
  value: number
}

const parseVariantModifier = (value: unknown): VariantStatModifier | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const source = value as Record<string, unknown>

  if (
    (source.op === 'add' || source.op === 'mult' || source.op === 'replace')
    && typeof source.value === 'number'
    && Number.isFinite(source.value)
  ) {
    return { op: source.op, value: source.value }
  }

  if (typeof source.add === 'number' && Number.isFinite(source.add)) {
    return { op: 'add', value: source.add }
  }
  if (typeof source.mult === 'number' && Number.isFinite(source.mult)) {
    return { op: 'mult', value: source.mult }
  }
  if (typeof source.replace === 'number' && Number.isFinite(source.replace)) {
    return { op: 'replace', value: source.replace }
  }

  return null
}

const applyVariantModifiers = (
  baseDefinition: PartDefinition,
  mergedDefinition: PartDefinition,
  sourceDefinition: Record<string, unknown>
): void => {
  const rawStatModifiers = sourceDefinition.statModifiers
  if (!rawStatModifiers || typeof rawStatModifiers !== 'object' || Array.isArray(rawStatModifiers)) {
    return
  }

  const normalizedStatModifiers: Record<string, VariantStatModifier> = {}

  for (const [statKey, rawModifier] of Object.entries(rawStatModifiers as Record<string, unknown>)) {
    const modifier = parseVariantModifier(rawModifier)
    if (!modifier) {
      console.warn(`[parts] Ignoring invalid stat modifier "${statKey}" on variant "${mergedDefinition.id}".`)
      continue
    }

    const baseValue = (baseDefinition as Record<string, unknown>)[statKey]
    if (typeof baseValue !== 'number' || !Number.isFinite(baseValue)) {
      console.warn(`[parts] Ignoring stat modifier "${statKey}" on variant "${mergedDefinition.id}": base stat is not numeric.`)
      continue
    }

    normalizedStatModifiers[statKey] = modifier

    let nextValue = baseValue
    if (modifier.op === 'add') {
      nextValue = baseValue + modifier.value
    } else if (modifier.op === 'mult') {
      nextValue = baseValue * modifier.value
    } else {
      nextValue = modifier.value
    }

    ;(mergedDefinition as Record<string, unknown>)[statKey] = nextValue
  }

  if (Object.keys(normalizedStatModifiers).length > 0) {
    ;(mergedDefinition as Record<string, unknown>).statModifiers = normalizedStatModifiers
  }
}

const resolveVariantSeedCatalog = (rawCatalog: PartDefinition[]): PartDefinition[] => {
  const rawById = new Map(rawCatalog.map((definition) => [definition.id, definition] as const))
  const resolvedById = new Map<string, PartDefinition>()
  const resolvingIds = new Set<string>()

  const resolveById = (id: string): PartDefinition | null => {
    const existingResolved = resolvedById.get(id)
    if (existingResolved) {
      return existingResolved
    }

    const rawDefinition = rawById.get(id)
    if (!rawDefinition) {
      return null
    }

    if (resolvingIds.has(id)) {
      console.warn(`[parts] Variant cycle detected while resolving "${id}".`)
      return null
    }

    resolvingIds.add(id)

    const sourceDefinition = rawDefinition as Record<string, unknown>
    const variantOf = typeof sourceDefinition.variantOf === 'string' ? sourceDefinition.variantOf.trim() : ''

    let resolvedDefinition: PartDefinition = { ...rawDefinition }

    if (variantOf) {
      const baseDefinition = resolveById(variantOf)
      if (!baseDefinition) {
        console.warn(`[parts] Variant "${id}" references missing base part "${variantOf}".`)
      } else {
        resolvedDefinition = {
          ...baseDefinition,
          ...rawDefinition,
          variantOf
        }
        applyVariantModifiers(baseDefinition, resolvedDefinition, sourceDefinition)
      }
    }

    resolvingIds.delete(id)
    resolvedById.set(id, resolvedDefinition)
    return resolvedDefinition
  }

  return rawCatalog.map((definition) => resolveById(definition.id) ?? { ...definition })
}

const loadSeedCatalog = (): PartDefinition[] => {
  if (typeof XMLHttpRequest === 'undefined') {
    return []
  }

  try {
    const request = new XMLHttpRequest()
    request.open('GET', new URL('./parts.json', import.meta.url).toString(), false)
    request.send()
    if (request.status >= 200 && request.status < 300) {
      const parsed = JSON.parse(request.responseText) as unknown
      if (!Array.isArray(parsed)) {
        return []
      }
      return resolveVariantSeedCatalog(parsed as PartDefinition[])
    }
  } catch {
    return []
  }

  return []
}

const seedCatalog = loadSeedCatalog()
const seedCatalogById = new Map(seedCatalog.map((definition) => [definition.id, definition] as const))

const createInstanceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `part-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const isSwappableWeaponDefinition = (definition: PartDefinition): boolean => {
  return (definition.category === 'HandWeapon' || definition.category === 'ShoulderWeapon')
    && !definition.deprecated
    && !definition.isPassive
}

const isAutoGarageSeedDefinition = (definition: PartDefinition): boolean => {
  if (isSwappableWeaponDefinition(definition)) {
    return true
  }
  return definition.category === 'Chip' && !definition.deprecated
}

const mergeWeaponAuthoritativeSeedFields = (
  mergedDefinition: PartDefinition,
  seedDefinition: PartDefinition | undefined
): PartDefinition => {
  if (!seedDefinition || !isSwappableWeaponDefinition(seedDefinition)) {
    return mergedDefinition
  }

  // Weapon stats/sounds in parts.json are authoritative on each load.
  return {
    ...mergedDefinition,
    damagePerShot: seedDefinition.damagePerShot,
    fireRateCooldownSeconds: seedDefinition.fireRateCooldownSeconds,
    projectileCount: seedDefinition.projectileCount,
    projectileType: seedDefinition.projectileType,
    spreadDegrees: seedDefinition.spreadDegrees,
    bulletSpeed: seedDefinition.bulletSpeed,
    clipSize: seedDefinition.clipSize,
    weaponReach: seedDefinition.weaponReach,
    meleeContactTimeMs: seedDefinition.meleeContactTimeMs,
    fireSound: seedDefinition.fireSound,
    meleeHitSound: seedDefinition.meleeHitSound,
    reloadSound: seedDefinition.reloadSound,
    damageType: seedDefinition.damageType,
    firingMode: seedDefinition.firingMode,
    horizontalLockAngle: seedDefinition.horizontalLockAngle,
    verticalLockAngle: seedDefinition.verticalLockAngle,
    effectiveRange: seedDefinition.effectiveRange,
    ammoConsumedPerShot: seedDefinition.ammoConsumedPerShot,
    energyPerShot: seedDefinition.energyPerShot,
    accuracy: seedDefinition.accuracy,
    stability: seedDefinition.stability,
    twoHanded: seedDefinition.twoHanded,
    heatGeneration: seedDefinition.heatGeneration,
    energyDrain: seedDefinition.energyDrain,
    passiveBonuses: Array.isArray(seedDefinition.passiveBonuses) ? [...seedDefinition.passiveBonuses] : [],
    activeAbilities: Array.isArray(seedDefinition.activeAbilities) ? [...seedDefinition.activeAbilities] : [],
    specialEffects: Array.isArray(seedDefinition.specialEffects) ? [...seedDefinition.specialEffects] : []
  }
}

const normalizeEffectConditions = (source: unknown, definitionId: string): PartEffectCondition | undefined => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return undefined
  }

  const raw = source as Record<string, unknown>
  const normalized: PartEffectCondition = {}

  if (typeof raw.epPercentGte === 'number' && Number.isFinite(raw.epPercentGte)) {
    normalized.epPercentGte = raw.epPercentGte
  }
  if (typeof raw.epPercentLte === 'number' && Number.isFinite(raw.epPercentLte)) {
    normalized.epPercentLte = raw.epPercentLte
  }
  if (typeof raw.heatPercentGte === 'number' && Number.isFinite(raw.heatPercentGte)) {
    normalized.heatPercentGte = raw.heatPercentGte
  }
  if (typeof raw.heatPercentLte === 'number' && Number.isFinite(raw.heatPercentLte)) {
    normalized.heatPercentLte = raw.heatPercentLte
  }
  if (typeof raw.isFlying === 'boolean') {
    normalized.isFlying = raw.isFlying
  }
  if (typeof raw.isMoving === 'boolean') {
    normalized.isMoving = raw.isMoving
  }
  if (typeof raw.isStandingStill === 'boolean') {
    normalized.isStandingStill = raw.isStandingStill
  }
  if (Array.isArray(raw.weaponTypeIn)) {
    const validTypes = raw.weaponTypeIn.filter(
      (entry): entry is 'ballistic' | 'energy' | 'missile' => entry === 'ballistic' || entry === 'energy' || entry === 'missile'
    )
    if (validTypes.length > 0) {
      normalized.weaponTypeIn = validTypes
    }
  }
  if (Array.isArray(raw.targetEnemyTypeIn)) {
    const validEnemyTypes = raw.targetEnemyTypeIn.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim())
    if (validEnemyTypes.length > 0) {
      normalized.targetEnemyTypeIn = validEnemyTypes
    }
  }

  if (normalized.epPercentGte !== undefined && normalized.epPercentLte !== undefined && normalized.epPercentGte > normalized.epPercentLte) {
    console.warn(`[parts] Ignoring contradictory EP condition bounds on "${definitionId}".`)
    delete normalized.epPercentGte
    delete normalized.epPercentLte
  }
  if (normalized.heatPercentGte !== undefined && normalized.heatPercentLte !== undefined && normalized.heatPercentGte > normalized.heatPercentLte) {
    console.warn(`[parts] Ignoring contradictory heat condition bounds on "${definitionId}".`)
    delete normalized.heatPercentGte
    delete normalized.heatPercentLte
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

const normalizeEffectModifiers = (source: unknown, definitionId: string): PartEffectModifier[] => {
  if (!Array.isArray(source)) {
    return []
  }

  const normalized: PartEffectModifier[] = []
  source.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return
    }
    const raw = entry as Record<string, unknown>
    const id = typeof raw.id === 'string' ? raw.id.trim() : `effect-${index + 1}`
    const op = raw.op === 'add' || raw.op === 'mult' ? raw.op : null
    const target = typeof raw.target === 'string' && PART_EFFECT_TARGETS.includes(raw.target as typeof PART_EFFECT_TARGETS[number])
      ? raw.target
      : null
    const value = typeof raw.value === 'number' && Number.isFinite(raw.value) ? raw.value : null

    if (!op || !target || value === null) {
      console.warn(`[parts] Ignoring invalid effect modifier on "${definitionId}" at index ${index}.`)
      return
    }

    normalized.push({
      id,
      op,
      target: target as PartEffectModifier['target'],
      value,
      conditions: normalizeEffectConditions(raw.conditions, definitionId),
      description: typeof raw.description === 'string' ? raw.description : undefined
    })
  })

  return normalized
}

const normalizeDefinition = (definition: PartDefinition): PartDefinition => {
  const seedDefinition = seedCatalogById.get(definition.id)
  const mergedDefinition = {
    ...(seedDefinition ?? {}),
    ...definition
  } as PartDefinition
  const normalizedDefinition = mergeWeaponAuthoritativeSeedFields(mergedDefinition, seedDefinition)

  const normalizedSpreadDegrees =
    (normalizedDefinition.category === 'HandWeapon' || normalizedDefinition.category === 'ShoulderWeapon')
    && !normalizedDefinition.isMelee
    && Math.max(1, Math.round(normalizedDefinition.projectileCount ?? 1)) <= 1
      ? 0
      : normalizedDefinition.spreadDegrees

  return {
    ...normalizedDefinition,
    armorValue: Math.max(0, Number(normalizedDefinition.armorValue ?? normalizedDefinition.integrity ?? 0)),
    chipSlots: Math.max(0, Math.floor(normalizedDefinition.chipSlots ?? 0)),
    computeBandWidth: normalizedDefinition.category === 'Computer'
      ? Math.max(0, Math.floor(normalizedDefinition.computeBandWidth ?? 100))
      : undefined,
    chipMemoryCost: normalizedDefinition.category === 'Chip'
      ? Math.max(0, Math.floor(normalizedDefinition.chipMemoryCost ?? 0))
      : undefined,
    spreadDegrees: normalizedSpreadDegrees,
    passiveBonuses: Array.isArray(normalizedDefinition.passiveBonuses) ? [...normalizedDefinition.passiveBonuses] : [],
    activeAbilities: Array.isArray(normalizedDefinition.activeAbilities) ? [...normalizedDefinition.activeAbilities] : [],
    specialEffects: Array.isArray(normalizedDefinition.specialEffects) ? [...normalizedDefinition.specialEffects] : [],
    chipModifiers: Array.isArray(normalizedDefinition.chipModifiers) ? [...normalizedDefinition.chipModifiers] : [],
    effectModifiers: normalizeEffectModifiers(normalizedDefinition.effectModifiers, normalizedDefinition.id)
  }
}

const getWindowStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const readJson = <T>(storageKey: string): T | null => {
  const storage = getWindowStorage()
  if (!storage) {
    return null
  }
  const rawValue = storage.getItem(storageKey)
  if (!rawValue) {
    return null
  }
  try {
    return JSON.parse(rawValue) as T
  } catch {
    return null
  }
}

const writeJson = (storageKey: string, value: unknown): void => {
  const storage = getWindowStorage()
  if (!storage) {
    return
  }
  storage.setItem(storageKey, JSON.stringify(value))
}

const clearLegacyCatalogStorage = (): void => {
  const storage = getWindowStorage()
  if (!storage) {
    return
  }
  storage.removeItem(CATALOG_STORAGE_KEY)
}

export const loadPartCatalog = (): PartDefinition[] => {
  clearLegacyCatalogStorage()
  return seedCatalog.map(normalizeDefinition)
}

export const savePartCatalog = (catalog: PartDefinition[]): void => {
  void catalog
  console.warn('[garage] Catalog persistence is disabled. Edit packages/client/src/data/parts/parts.json directly.')
}

export const loadDevModeFlag = (): boolean => {
  const storage = getWindowStorage()
  if (!storage) {
    return false
  }
  return storage.getItem(DEV_MODE_STORAGE_KEY) === 'true'
}

export const saveDevModeFlag = (enabled: boolean): void => {
  const storage = getWindowStorage()
  if (!storage) {
    return
  }
  storage.setItem(DEV_MODE_STORAGE_KEY, enabled ? 'true' : 'false')
}

const createSeedInstances = (): { inventory: PartInstance[]; loadout: MechLoadout } => {
  const inventory: PartInstance[] = []
  const loadout: MechLoadout = {}
  const equippedDefinitionIds: Record<string, string> = {
    Head: 'basic.head',
    Computer: 'basic.computer',
    Core: 'basic.exoshell',
    Generator: 'basic.generator',
    ThermalRegulator: 'basic.thermal',
    LeftArm: 'basic.left-arm',
    RightArm: 'basic.right-arm',
    Utility1: 'basic.utility1',
    Utility2: 'basic.jetpack',
    GroundMobility: 'basic.legs'
  }

  const equippedWeaponSlotIds: Partial<Record<WeaponMountSlot, string>> = {
    LeftHand: 'basic.sword',
    RightHand: 'basic.pistol',
    ShoulderLeft: 'basic.minigun',
    ShoulderRight: 'basic.plasma-cannon'
  }

  const bonusDefinitionIds: string[] = [
    'scout.head',
    'tactical.computer',
    'heavy.exoshell',
    'high.output.generator',
    'overclocked.thermal',
    'reinforced.left-arm',
    'stabilized.right-arm',
    'sensor.utility1',
    'basic.rotor.dual',
    'basic.wheels',
    'basic.treads',
    'basic.hover',
    'basic.head',
    'basic.laser-pistol',
    'basic.shotgun',
    'chip.ep-regen.booster',
    'chip.energy-amp',
    'chip.flight-efficiency',
    'chip.turn-servo-tax',
    'chip.cooling-logic-pack',
    'chip.sensor-burst-cache',
    'chip.recoil-optimizer'
  ]

  for (const [slotKey, definitionId] of Object.entries(equippedDefinitionIds)) {
    const definition = seedCatalog.find((entry) => entry.id === definitionId)
    if (!definition) {
      continue
    }
    const instanceId = createInstanceId()
    inventory.push({
      instanceId,
      definitionId,
      currentIntegrity: definition.integrity,
      modifiers: [],
      installedChips: [],
      rngSeed: Math.floor(Math.random() * 1_000_000)
    })
    ;(loadout as Record<string, string>)[slotKey] = instanceId
  }

  for (const [slot, definitionId] of Object.entries(equippedWeaponSlotIds) as Array<[WeaponMountSlot, string]>) {
    const definition = seedCatalog.find((entry) => entry.id === definitionId)
    if (!definition) {
      continue
    }
    const instanceId = createInstanceId()
    inventory.push({
      instanceId,
      definitionId,
      currentIntegrity: definition.integrity,
      modifiers: [],
      installedChips: [],
      rngSeed: Math.floor(Math.random() * 1_000_000)
    })
    loadout[slot] = instanceId
  }

  bonusDefinitionIds.forEach((definitionId, index) => {
    const definition = seedCatalog.find((entry) => entry.id === definitionId)
    if (!definition) {
      return
    }
    inventory.push({
      instanceId: createInstanceId(),
      definitionId,
      currentIntegrity: definitionId === 'basic.head' ? 34 : definition.integrity,
      modifiers: definitionId === 'basic.head' ? [{ id: 'range-upgrade', type: 'stat_mult', stat: 'range', value: 0.1 }] : [],
      installedChips: [],
      rngSeed: Math.floor(Math.random() * 1_000_000)
    })
  })

  const ownedDefinitionIds = new Set(inventory.map((entry) => entry.definitionId))
  for (const definition of seedCatalog) {
    if (!isAutoGarageSeedDefinition(definition) || ownedDefinitionIds.has(definition.id)) {
      continue
    }
    inventory.push({
      instanceId: createInstanceId(),
      definitionId: definition.id,
      currentIntegrity: definition.integrity,
      modifiers: [],
      installedChips: [],
      rngSeed: Math.floor(Math.random() * 1_000_000)
    })
    ownedDefinitionIds.add(definition.id)
  }

  return { inventory, loadout }
}

const normalizeInstance = (instance: PartInstance, catalog: PartDefinition[]): PartInstance | null => {
  const definition = catalog.find((entry) => entry.id === instance.definitionId)
  if (!definition) {
    return null
  }
  const normalizedInstalledChips = Array.isArray(instance.installedChips)
    ? instance.installedChips.flatMap((entry) => {
      if (typeof entry === 'string') {
        return [{ chipInstanceId: entry, active: true }]
      }
      if (!entry || typeof entry !== 'object') {
        return []
      }
      const maybeState = entry as { chipInstanceId?: unknown; active?: unknown }
      const chipInstanceId = typeof maybeState.chipInstanceId === 'string' ? maybeState.chipInstanceId : ''
      if (!chipInstanceId) {
        return []
      }
      return [{ chipInstanceId, active: maybeState.active !== false }]
    })
    : []

  const parsedIntegrity = Number(instance.currentIntegrity)
  const normalizedIntegrity = Number.isFinite(parsedIntegrity) ? parsedIntegrity : definition.integrity

  return {
    instanceId: String(instance.instanceId),
    definitionId: definition.id,
    currentIntegrity: Math.max(0, Math.min(definition.integrity, normalizedIntegrity)),
    modifiers: Array.isArray(instance.modifiers) ? [...instance.modifiers] : [],
    installedChips: normalizedInstalledChips,
    rngSeed: Number.isFinite(instance.rngSeed) ? instance.rngSeed : Math.floor(Math.random() * 1_000_000)
  }
}

export const loadGarageInventory = (catalog: PartDefinition[]): { inventory: PartInstance[]; loadout: MechLoadout } => {
  const storedInventory = readJson<PartInstance[]>(INVENTORY_STORAGE_KEY)
  const storedLoadout = readJson<MechLoadout>(LOADOUT_STORAGE_KEY)

  if (!Array.isArray(storedInventory) || !storedLoadout) {
    const seeded = createSeedInstances()
    saveGarageInventory(seeded.inventory, seeded.loadout)
    return seeded
  }

  const normalizedInventory = storedInventory
    .map((entry) => normalizeInstance(entry, catalog))
    .filter((entry): entry is PartInstance => entry !== null)

  const loadout: MechLoadout = {}
  for (const category of ['Head', 'Computer', 'Core', 'Generator', 'ThermalRegulator', 'LeftArm', 'RightArm', 'Utility1', 'Utility2', 'GroundMobility'] as const) {
    const instanceId = storedLoadout[category]
    if (typeof instanceId === 'string' && normalizedInventory.some((entry) => entry.instanceId === instanceId)) {
      loadout[category] = instanceId
    }
  }
  for (const slot of ['LeftHand', 'RightHand', 'ShoulderLeft', 'ShoulderRight'] as const) {
    const instanceId = storedLoadout[slot]
    if (typeof instanceId === 'string' && normalizedInventory.some((entry) => entry.instanceId === instanceId)) {
      loadout[slot] = instanceId
    }
  }

  const thermalInstances = normalizedInventory.filter((entry) => {
    const definition = catalog.find((candidate) => candidate.id === entry.definitionId)
    return definition?.category === 'ThermalRegulator'
  })
  if (thermalInstances.length === 0) {
    const defaultThermal = catalog.find((entry) => entry.id === 'basic.thermal' && entry.category === 'ThermalRegulator')
    if (defaultThermal) {
      const thermalInstanceId = createInstanceId()
      normalizedInventory.push({
        instanceId: thermalInstanceId,
        definitionId: defaultThermal.id,
        currentIntegrity: defaultThermal.integrity,
        modifiers: [],
        installedChips: [],
        rngSeed: Math.floor(Math.random() * 1_000_000)
      })
      loadout.ThermalRegulator = thermalInstanceId
    }
  } else if (!loadout.ThermalRegulator) {
    const firstThermal = thermalInstances[0]
    if (firstThermal) {
      loadout.ThermalRegulator = firstThermal.instanceId
    }
  }

  const ensureOwnedDefinition = (definitionId: string): PartInstance | null => {
    const existing = normalizedInventory.find((entry) => entry.definitionId === definitionId)
    if (existing) {
      return existing
    }
    const definition = catalog.find((entry) => entry.id === definitionId)
    if (!definition) {
      return null
    }
    const created: PartInstance = {
      instanceId: createInstanceId(),
      definitionId: definition.id,
      currentIntegrity: definition.integrity,
      modifiers: [],
      installedChips: [],
      rngSeed: Math.floor(Math.random() * 1_000_000)
    }
    normalizedInventory.push(created)
    return created
  }

  const defaultGroundMobility = ensureOwnedDefinition('basic.legs')
  if (!loadout.GroundMobility && defaultGroundMobility) {
    loadout.GroundMobility = defaultGroundMobility.instanceId
  }
  void ensureOwnedDefinition('basic.wheels')
  void ensureOwnedDefinition('basic.treads')
  void ensureOwnedDefinition('basic.hover')

  const ownedDefinitionIds = new Set(normalizedInventory.map((entry) => entry.definitionId))
  for (const definition of catalog) {
    if (!isAutoGarageSeedDefinition(definition) || ownedDefinitionIds.has(definition.id)) {
      continue
    }
    normalizedInventory.push({
      instanceId: createInstanceId(),
      definitionId: definition.id,
      currentIntegrity: definition.integrity,
      modifiers: [],
      installedChips: [],
      rngSeed: Math.floor(Math.random() * 1_000_000)
    })
    ownedDefinitionIds.add(definition.id)
  }

  return { inventory: normalizedInventory, loadout }
}

export const saveGarageInventory = (inventory: PartInstance[], loadout: MechLoadout): void => {
  writeJson(INVENTORY_STORAGE_KEY, inventory)
  writeJson(LOADOUT_STORAGE_KEY, loadout)
}

export const getCatalogStorageKeys = (): { catalog: string; inventory: string; loadout: string; devMode: string } => ({
  catalog: CATALOG_STORAGE_KEY,
  inventory: INVENTORY_STORAGE_KEY,
  loadout: LOADOUT_STORAGE_KEY,
  devMode: DEV_MODE_STORAGE_KEY
})
