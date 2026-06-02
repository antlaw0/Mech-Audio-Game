import type { PartDefinition, PartInstance, MechLoadout, PartCategory, WeaponMountSlot } from './types.js'

const CATALOG_STORAGE_KEY = 'mech.parts.catalog.v1'
const INVENTORY_STORAGE_KEY = 'mech.parts.inventory.v1'
const LOADOUT_STORAGE_KEY = 'mech.parts.loadout.v1'
const DEV_MODE_STORAGE_KEY = 'mech.parts.devMode.v1'

const loadSeedCatalog = (): PartDefinition[] => {
  if (typeof XMLHttpRequest === 'undefined') {
    return []
  }

  try {
    const request = new XMLHttpRequest()
    request.open('GET', new URL('./parts.json', import.meta.url).toString(), false)
    request.send()
    if (request.status >= 200 && request.status < 300) {
      const parsed = JSON.parse(request.responseText) as PartDefinition[]
      return Array.isArray(parsed) ? parsed : []
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
    chipModifiers: Array.isArray(normalizedDefinition.chipModifiers) ? [...normalizedDefinition.chipModifiers] : []
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
    Utility2: 'basic.jetpack'
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

  return {
    instanceId: String(instance.instanceId),
    definitionId: definition.id,
    currentIntegrity: Math.max(0, Math.min(definition.integrity, Number(instance.currentIntegrity) || definition.integrity)),
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
  for (const category of ['Head', 'Computer', 'Core', 'Generator', 'ThermalRegulator', 'LeftArm', 'RightArm', 'Utility1', 'Utility2'] as const) {
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
