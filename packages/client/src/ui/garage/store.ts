import {
  loadDevModeFlag,
  loadGarageInventory,
  loadPartCatalog,
  saveDevModeFlag,
  saveGarageInventory,
  savePartCatalog
} from '../../data/parts/catalog.js'
import {
  CATEGORY_LABELS,
  PART_CATEGORIES,
  PART_DEFINITION_NUMERIC_KEYS,
  type GarageSnapshot,
  type MechLoadout,
  type PartCategory,
  type PartNumericKey,
  type PartDefinition,
  type PartInstance
} from '../../data/parts/types.js'

const SAVE_DEBOUNCE_MS = 250

export type EquipValidation = {
  valid: boolean
  warnings: string[]
}

export type CatalogImportResult = {
  definitionCount: number
  removedInventoryCount: number
  clearedLoadoutSlots: PartCategory[]
}

export type GarageStore = {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => GarageSnapshot
  getDefinitionsByCategory: (category: PartCategory) => PartDefinition[]
  getGarageInstancesByCategory: (category: PartCategory) => PartInstance[]
  getEquippedInstance: (category: PartCategory) => PartInstance | null
  getInstance: (instanceId: string) => PartInstance | null
  getDefinition: (definitionId: string) => PartDefinition | null
  setDevMode: (enabled: boolean) => void
  equipInstance: (category: PartCategory, instanceId: string) => void
  unequipSlot: (category: PartCategory) => void
  addDefinition: (definition: PartDefinition) => void
  updateDefinition: (definitionId: string, nextDefinition: PartDefinition) => void
  deleteDefinition: (definitionId: string) => { deprecated: boolean }
  createInstanceFromDefinition: (definitionId: string) => PartInstance
  validateEquip: (category: PartCategory, instanceId: string, callback?: (snapshot: GarageSnapshot) => EquipValidation) => EquipValidation
  getCategoryLabel: (category: PartCategory) => string
  exportCatalogJson: () => string
  importCatalogJson: (raw: string) => CatalogImportResult
}

const createInstanceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `part-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const cloneLoadout = (loadout: MechLoadout): MechLoadout => ({ ...loadout })

const REQUIRED_NUMERIC_KEYS: readonly PartNumericKey[] = ['integrity', 'weight', 'PDEF', 'EDEF', 'energyDrain']

const parseFiniteNumber = (value: unknown, fieldName: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid field "${fieldName}": expected a finite number.`)
  }
  return value
}

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((entry): entry is string => typeof entry === 'string')
}

const normalizeCatalogDefinition = (entry: unknown, index: number): PartDefinition => {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`Invalid catalog entry at index ${index}: expected an object.`)
  }

  const source = entry as Record<string, unknown>
  const id = typeof source.id === 'string' ? source.id.trim() : ''
  const name = typeof source.name === 'string' ? source.name.trim() : ''
  const categoryRaw = typeof source.category === 'string' ? source.category : ''

  if (!id) {
    throw new Error(`Invalid catalog entry at index ${index}: id is required.`)
  }
  if (!name) {
    throw new Error(`Invalid catalog entry "${id}": name is required.`)
  }
  if (!PART_CATEGORIES.includes(categoryRaw as PartCategory)) {
    throw new Error(`Invalid catalog entry "${id}": category "${categoryRaw}" is not supported.`)
  }

  const normalized: PartDefinition = {
    id,
    name,
    category: categoryRaw as PartCategory,
    integrity: parseFiniteNumber(source.integrity, `${id}.integrity`),
    weight: parseFiniteNumber(source.weight, `${id}.weight`),
    PDEF: parseFiniteNumber(source.PDEF, `${id}.PDEF`),
    EDEF: parseFiniteNumber(source.EDEF, `${id}.EDEF`),
    energyDrain: parseFiniteNumber(source.energyDrain, `${id}.energyDrain`),
    deprecated: source.deprecated === true,
    passiveBonuses: normalizeStringArray(source.passiveBonuses),
    activeAbilities: normalizeStringArray(source.activeAbilities),
    specialEffects: normalizeStringArray(source.specialEffects)
  }

  for (const key of PART_DEFINITION_NUMERIC_KEYS) {
    if (REQUIRED_NUMERIC_KEYS.includes(key)) {
      continue
    }
    const value = source[key]
    if (value === undefined || value === null) {
      continue
    }
    ;(normalized as Record<string, unknown>)[key] = parseFiniteNumber(value, `${id}.${key}`)
  }

  if (typeof source.flightType === 'string') {
    normalized.flightType = source.flightType
  }

  return normalized
}

export const createGarageStore = (): GarageStore => {
  let catalog = loadPartCatalog()
  let { inventory, loadout } = loadGarageInventory(catalog)
  let devModeEnabled = loadDevModeFlag()
  let pendingCatalogSave = 0
  const listeners = new Set<() => void>()

  const emitChange = (): void => {
    listeners.forEach((listener) => listener())
  }

  const persistInventory = (): void => {
    saveGarageInventory(inventory, loadout)
  }

  const persistCatalogDebounced = (): void => {
    if (pendingCatalogSave > 0) {
      window.clearTimeout(pendingCatalogSave)
    }
    pendingCatalogSave = window.setTimeout(() => {
      pendingCatalogSave = 0
      savePartCatalog(catalog)
    }, SAVE_DEBOUNCE_MS)
  }

  const persistCatalogNow = (): void => {
    if (pendingCatalogSave > 0) {
      window.clearTimeout(pendingCatalogSave)
      pendingCatalogSave = 0
    }
    savePartCatalog(catalog)
  }

  const getSnapshot = (): GarageSnapshot => ({
    catalog: catalog.map((entry) => ({ ...entry })),
    inventory: inventory.map((entry) => ({
      ...entry,
      modifiers: [...entry.modifiers],
      installedChips: [...entry.installedChips]
    })),
    loadout: cloneLoadout(loadout),
    devModeEnabled
  })

  const getDefinition = (definitionId: string): PartDefinition | null => {
    return catalog.find((entry) => entry.id === definitionId) ?? null
  }

  const getInstance = (instanceId: string): PartInstance | null => {
    return inventory.find((entry) => entry.instanceId === instanceId) ?? null
  }

  const getDefinitionsByCategory = (category: PartCategory): PartDefinition[] => {
    return catalog.filter((entry) => entry.category === category)
  }

  const getGarageInstancesByCategory = (category: PartCategory): PartInstance[] => {
    const equippedIds = new Set(Object.values(loadout).filter((entry): entry is string => typeof entry === 'string'))
    return inventory.filter((entry) => {
      const definition = getDefinition(entry.definitionId)
      return definition?.category === category && !equippedIds.has(entry.instanceId)
    })
  }

  const getEquippedInstance = (category: PartCategory): PartInstance | null => {
    const instanceId = loadout[category]
    if (!instanceId) {
      return null
    }
    return getInstance(instanceId)
  }

  const validateEquip = (category: PartCategory, instanceId: string, callback?: (snapshot: GarageSnapshot) => EquipValidation): EquipValidation => {
    const instance = getInstance(instanceId)
    const definition = instance ? getDefinition(instance.definitionId) : null
    if (!instance || !definition) {
      return { valid: false, warnings: ['Selected part instance no longer exists.'] }
    }
    if (definition.category !== category) {
      return { valid: false, warnings: [`${definition.name} cannot be installed in ${CATEGORY_LABELS[category]}.`] }
    }
    if (!callback) {
      return { valid: true, warnings: [] }
    }
    const previewLoadout = cloneLoadout(loadout)
    previewLoadout[category] = instanceId
    return callback({
      catalog: catalog.map((entry) => ({ ...entry })),
      inventory: inventory.map((entry) => ({ ...entry, modifiers: [...entry.modifiers], installedChips: [...entry.installedChips] })),
      loadout: previewLoadout,
      devModeEnabled
    })
  }

  const setDevMode = (enabled: boolean): void => {
    devModeEnabled = enabled
    saveDevModeFlag(enabled)
    emitChange()
  }

  const equipInstance = (category: PartCategory, instanceId: string): void => {
    const instance = getInstance(instanceId)
    const definition = instance ? getDefinition(instance.definitionId) : null
    if (!instance || !definition || definition.category !== category) {
      throw new Error('Invalid equip target.')
    }
    loadout = {
      ...loadout,
      [category]: instanceId
    }
    persistInventory()
    emitChange()
  }

  const unequipSlot = (category: PartCategory): void => {
    const nextLoadout = cloneLoadout(loadout)
    delete nextLoadout[category]
    loadout = nextLoadout
    persistInventory()
    emitChange()
  }

  const ensureUniqueDefinition = (nextDefinition: PartDefinition, currentDefinitionId?: string): void => {
    const idConflict = catalog.some((entry) => entry.id === nextDefinition.id && entry.id !== currentDefinitionId)
    if (idConflict) {
      throw new Error(`A part definition with id "${nextDefinition.id}" already exists.`)
    }
  }

  const addDefinition = (definition: PartDefinition): void => {
    ensureUniqueDefinition(definition)
    catalog = [...catalog, { ...definition }]
    persistCatalogDebounced()
    emitChange()
  }

  const updateDefinition = (definitionId: string, nextDefinition: PartDefinition): void => {
    ensureUniqueDefinition(nextDefinition, definitionId)
    if (definitionId !== nextDefinition.id) {
      inventory = inventory.map((entry) => (
        entry.definitionId === definitionId
          ? { ...entry, definitionId: nextDefinition.id }
          : entry
      ))
      persistInventory()
    }
    catalog = catalog.map((entry) => (entry.id === definitionId ? { ...nextDefinition } : entry))
    persistCatalogDebounced()
    emitChange()
  }

  const deleteDefinition = (definitionId: string): { deprecated: boolean } => {
    const isReferenced = inventory.some((entry) => entry.definitionId === definitionId)
      || Object.values(loadout).some((instanceId) => {
        if (!instanceId) {
          return false
        }
        const instance = getInstance(instanceId)
        return instance?.definitionId === definitionId
      })

    if (isReferenced) {
      catalog = catalog.map((entry) => (entry.id === definitionId ? { ...entry, deprecated: true } : entry))
      persistCatalogDebounced()
      emitChange()
      return { deprecated: true }
    }

    catalog = catalog.filter((entry) => entry.id !== definitionId)
    persistCatalogDebounced()
    emitChange()
    return { deprecated: false }
  }

  const createInstanceFromDefinition = (definitionId: string): PartInstance => {
    const definition = getDefinition(definitionId)
    if (!definition) {
      throw new Error('Unknown part definition.')
    }
    const instance: PartInstance = {
      instanceId: createInstanceId(),
      definitionId,
      currentIntegrity: definition.integrity,
      modifiers: [],
      installedChips: [],
      rngSeed: Math.floor(Math.random() * 1_000_000)
    }
    inventory = [...inventory, instance]
    persistInventory()
    emitChange()
    return instance
  }

  return {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot,
    getDefinitionsByCategory,
    getGarageInstancesByCategory,
    getEquippedInstance,
    getInstance,
    getDefinition,
    setDevMode,
    equipInstance,
    unequipSlot,
    addDefinition,
    updateDefinition,
    deleteDefinition,
    createInstanceFromDefinition,
    validateEquip,
    getCategoryLabel: (category) => CATEGORY_LABELS[category],
    exportCatalogJson: () => `${JSON.stringify(catalog.map((entry) => ({ ...entry })), null, 2)}\n`,
    importCatalogJson: (raw) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        throw new Error('Import failed: file is not valid JSON.')
      }

      if (!Array.isArray(parsed)) {
        throw new Error('Import failed: root JSON value must be an array of part definitions.')
      }
      if (parsed.length === 0) {
        throw new Error('Import failed: catalog array cannot be empty.')
      }

      const nextCatalog = parsed.map((entry, index) => normalizeCatalogDefinition(entry, index))
      const seenIds = new Set<string>()
      nextCatalog.forEach((entry) => {
        if (seenIds.has(entry.id)) {
          throw new Error(`Import failed: duplicate id "${entry.id}" found.`)
        }
        seenIds.add(entry.id)
      })

      catalog = nextCatalog

      const inventoryBefore = inventory.length
      inventory = inventory.filter((entry) => seenIds.has(entry.definitionId))
      const removedInventoryCount = inventoryBefore - inventory.length

      const knownInstanceIds = new Set(inventory.map((entry) => entry.instanceId))
      const nextLoadout = cloneLoadout(loadout)
      const clearedLoadoutSlots: PartCategory[] = []
      PART_CATEGORIES.forEach((category) => {
        const instanceId = nextLoadout[category]
        if (!instanceId) {
          return
        }
        if (!knownInstanceIds.has(instanceId)) {
          delete nextLoadout[category]
          clearedLoadoutSlots.push(category)
        }
      })
      loadout = nextLoadout

      persistCatalogNow()
      persistInventory()
      emitChange()

      return {
        definitionCount: catalog.length,
        removedInventoryCount,
        clearedLoadoutSlots
      }
    }
  }
}

export const GARAGE_CATEGORY_ORDER = [...PART_CATEGORIES]
