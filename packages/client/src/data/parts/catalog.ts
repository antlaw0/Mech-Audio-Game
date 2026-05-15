import type { PartDefinition, PartInstance, MechLoadout, PartCategory } from './types.js'

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

const createInstanceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `part-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const normalizeDefinition = (definition: PartDefinition): PartDefinition => ({
  ...definition,
  passiveBonuses: Array.isArray(definition.passiveBonuses) ? [...definition.passiveBonuses] : [],
  activeAbilities: Array.isArray(definition.activeAbilities) ? [...definition.activeAbilities] : [],
  specialEffects: Array.isArray(definition.specialEffects) ? [...definition.specialEffects] : []
})

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

export const loadPartCatalog = (): PartDefinition[] => {
  const stored = readJson<PartDefinition[]>(CATALOG_STORAGE_KEY)
  if (!Array.isArray(stored) || stored.length === 0) {
    return seedCatalog.map(normalizeDefinition)
  }
  return stored.map(normalizeDefinition)
}

export const savePartCatalog = (catalog: PartDefinition[]): void => {
  writeJson(CATALOG_STORAGE_KEY, catalog.map(normalizeDefinition))
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
  const equippedDefinitionIds: Record<PartCategory, string> = {
    Head: 'basic.head',
    Computer: 'basic.computer',
    Core: 'basic.exoshell',
    Generator: 'basic.generator',
    LeftArm: 'basic.left-arm',
    RightArm: 'basic.right-arm',
    Utility1: 'basic.utility1',
    Utility2: 'basic.jetpack'
  }

  const bonusDefinitionIds: string[] = [
    'scout.head',
    'tactical.computer',
    'heavy.exoshell',
    'high.output.generator',
    'reinforced.left-arm',
    'stabilized.right-arm',
    'sensor.utility1',
    'basic.rotor.dual',
    'basic.head'
  ]

  for (const [category, definitionId] of Object.entries(equippedDefinitionIds) as Array<[PartCategory, string]>) {
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
    loadout[category] = instanceId
  }

  bonusDefinitionIds.forEach((definitionId, index) => {
    const definition = seedCatalog.find((entry) => entry.id === definitionId)
    if (!definition) {
      return
    }
    inventory.push({
      instanceId: createInstanceId(),
      definitionId,
      currentIntegrity: index === bonusDefinitionIds.length - 1 ? 34 : definition.integrity,
      modifiers: index === bonusDefinitionIds.length - 1 ? [{ id: 'range-upgrade', type: 'stat_mult', stat: 'range', value: 0.1 }] : [],
      installedChips: index === 1 ? ['mk1-lock-chip'] : [],
      rngSeed: Math.floor(Math.random() * 1_000_000)
    })
  })

  return { inventory, loadout }
}

const normalizeInstance = (instance: PartInstance, catalog: PartDefinition[]): PartInstance | null => {
  const definition = catalog.find((entry) => entry.id === instance.definitionId)
  if (!definition) {
    return null
  }
  return {
    instanceId: String(instance.instanceId),
    definitionId: definition.id,
    currentIntegrity: Math.max(0, Math.min(definition.integrity, Number(instance.currentIntegrity) || definition.integrity)),
    modifiers: Array.isArray(instance.modifiers) ? [...instance.modifiers] : [],
    installedChips: Array.isArray(instance.installedChips) ? [...instance.installedChips] : [],
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
  for (const category of ['Head', 'Computer', 'Core', 'Generator', 'LeftArm', 'RightArm', 'Utility1', 'Utility2'] as const) {
    const instanceId = storedLoadout[category]
    if (typeof instanceId === 'string' && normalizedInventory.some((entry) => entry.instanceId === instanceId)) {
      loadout[category] = instanceId
    }
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
