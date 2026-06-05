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
  PART_EFFECT_TARGETS,
  PART_CATEGORIES,
  PART_DEFINITION_NUMERIC_KEYS,
  WEAPON_MOUNT_SLOTS,
  type GarageSnapshot,
  type MechLoadout,
  type PartCategory,
  type PartNumericKey,
  type PartEffectCondition,
  type PartEffectModifier,
  type PartDefinition,
  type PartVariantStatModifier,
  type PartVariantStatModifierInput,
  type PartInstance,
  type WeaponMountSlot
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

export type ChipActivationResult = {
  success: boolean
  reason?: 'not_enough_compute' | 'invalid_target'
  message?: string
}

export type GarageStore = {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => GarageSnapshot
  getDefinitionsByCategory: (category: PartCategory) => PartDefinition[]
  getGarageInstancesByCategory: (category: PartCategory) => PartInstance[]
  getEquippedInstance: (category: PartCategory) => PartInstance | null
  getEquippedInWeaponSlot: (slot: WeaponMountSlot) => PartInstance | null
  getInstance: (instanceId: string) => PartInstance | null
  getDefinition: (definitionId: string) => PartDefinition | null
  setDevMode: (enabled: boolean) => void
  equipInstance: (category: PartCategory, instanceId: string) => void
  equipToWeaponSlot: (slot: WeaponMountSlot, instanceId: string) => void
  unequipSlot: (category: PartCategory) => void
  unequipWeaponSlot: (slot: WeaponMountSlot) => void
  addDefinition: (definition: PartDefinition) => void
  updateDefinition: (definitionId: string, nextDefinition: PartDefinition) => void
  deleteDefinition: (definitionId: string) => { deprecated: boolean }
  createInstanceFromDefinition: (definitionId: string) => PartInstance
  installChipIntoPart: (hostInstanceId: string, chipInstanceId: string, slotIndex: number) => ChipActivationResult
  removeChipFromPart: (hostInstanceId: string, chipInstanceId: string) => ChipActivationResult
  setChipActive: (hostInstanceId: string, chipInstanceId: string, active: boolean) => ChipActivationResult
  findChipHostInstance: (chipInstanceId: string) => PartInstance | null
  validateEquip: (category: PartCategory, instanceId: string, callback?: (snapshot: GarageSnapshot) => EquipValidation) => EquipValidation
  validateEquipToWeaponSlot: (slot: WeaponMountSlot, instanceId: string, callback?: (snapshot: GarageSnapshot) => EquipValidation) => EquipValidation
  getCategoryLabel: (category: PartCategory) => string
  isTwoHandedWeaponEquipped: () => boolean
  isTwoShoulderedWeaponEquipped: () => boolean
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

const normalizeEffectConditions = (value: unknown): PartEffectCondition | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const source = value as Record<string, unknown>
  const normalized: PartEffectCondition = {}

  if (typeof source.epPercentGte === 'number' && Number.isFinite(source.epPercentGte)) {
    normalized.epPercentGte = source.epPercentGte
  }
  if (typeof source.epPercentLte === 'number' && Number.isFinite(source.epPercentLte)) {
    normalized.epPercentLte = source.epPercentLte
  }
  if (typeof source.heatPercentGte === 'number' && Number.isFinite(source.heatPercentGte)) {
    normalized.heatPercentGte = source.heatPercentGte
  }
  if (typeof source.heatPercentLte === 'number' && Number.isFinite(source.heatPercentLte)) {
    normalized.heatPercentLte = source.heatPercentLte
  }
  if (typeof source.isFlying === 'boolean') {
    normalized.isFlying = source.isFlying
  }
  if (typeof source.isMoving === 'boolean') {
    normalized.isMoving = source.isMoving
  }
  if (typeof source.isStandingStill === 'boolean') {
    normalized.isStandingStill = source.isStandingStill
  }
  if (Array.isArray(source.weaponTypeIn)) {
    const weaponTypeIn = source.weaponTypeIn.filter(
      (entry): entry is 'ballistic' | 'energy' | 'missile' => entry === 'ballistic' || entry === 'energy' || entry === 'missile'
    )
    if (weaponTypeIn.length > 0) {
      normalized.weaponTypeIn = weaponTypeIn
    }
  }
  if (Array.isArray(source.targetEnemyTypeIn)) {
    const targetEnemyTypeIn = source.targetEnemyTypeIn
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim())
    if (targetEnemyTypeIn.length > 0) {
      normalized.targetEnemyTypeIn = targetEnemyTypeIn
    }
  }

  if (normalized.epPercentGte !== undefined && normalized.epPercentLte !== undefined && normalized.epPercentGte > normalized.epPercentLte) {
    throw new Error('Invalid effect condition: epPercentGte cannot be greater than epPercentLte.')
  }
  if (normalized.heatPercentGte !== undefined && normalized.heatPercentLte !== undefined && normalized.heatPercentGte > normalized.heatPercentLte) {
    throw new Error('Invalid effect condition: heatPercentGte cannot be greater than heatPercentLte.')
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

const normalizeEffectModifiers = (value: unknown, id: string): PartEffectModifier[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Invalid field "${id}.effectModifiers[${index}]": expected an object.`)
    }

    const source = entry as Record<string, unknown>
    const effectId = typeof source.id === 'string' && source.id.trim().length > 0
      ? source.id.trim()
      : `effect-${index + 1}`
    const target = typeof source.target === 'string' ? source.target : ''
    const op = source.op === 'add' || source.op === 'mult' ? source.op : null
    const effectValue = source.value

    if (!PART_EFFECT_TARGETS.includes(target as typeof PART_EFFECT_TARGETS[number])) {
      throw new Error(`Invalid field "${id}.effectModifiers[${index}].target": unsupported target "${target}".`)
    }
    if (!op) {
      throw new Error(`Invalid field "${id}.effectModifiers[${index}].op": expected "add" or "mult".`)
    }
    if (typeof effectValue !== 'number' || !Number.isFinite(effectValue)) {
      throw new Error(`Invalid field "${id}.effectModifiers[${index}].value": expected a finite number.`)
    }

    return [{
      id: effectId,
      target: target as PartEffectModifier['target'],
      op,
      value: effectValue,
      conditions: normalizeEffectConditions(source.conditions),
      description: typeof source.description === 'string' ? source.description : undefined
    }]
  })
}

const parseVariantStatModifier = (value: unknown): PartVariantStatModifier | null => {
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

  if (
    (source.op === 'additive' || source.op === 'multiplier')
    && typeof source.value === 'number'
    && Number.isFinite(source.value)
  ) {
    return {
      op: source.op === 'additive' ? 'add' : 'mult',
      value: source.value
    }
  }

  if (typeof source.add === 'number' && Number.isFinite(source.add)) {
    return { op: 'add', value: source.add }
  }
  if (typeof source.additive === 'number' && Number.isFinite(source.additive)) {
    return { op: 'add', value: source.additive }
  }
  if (typeof source.mult === 'number' && Number.isFinite(source.mult)) {
    return { op: 'mult', value: source.mult }
  }
  if (typeof source.multiplier === 'number' && Number.isFinite(source.multiplier)) {
    return { op: 'mult', value: source.multiplier }
  }
  if (typeof source.replace === 'number' && Number.isFinite(source.replace)) {
    return { op: 'replace', value: source.replace }
  }

  return null
}

const normalizeVariantStatModifiers = (value: unknown, id: string): Record<string, PartVariantStatModifierInput> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid field "${id}.statModifiers": expected an object.`)
  }

  const normalized: Record<string, PartVariantStatModifierInput> = {}
  const source = value as Record<string, unknown>

  Object.entries(source).forEach(([statKey, rawModifier]) => {
    const modifier = parseVariantStatModifier(rawModifier)
    if (!modifier) {
      throw new Error(
        `Invalid field "${id}.statModifiers.${statKey}": expected add/additive, mult/multiplier, or replace modifier with numeric value.`
      )
    }
    normalized[statKey] = modifier
  })

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

const applyVariantStats = (
  baseDefinition: PartDefinition,
  mergedDefinition: PartDefinition,
  sourceDefinition: PartDefinition
): void => {
  if (!sourceDefinition.statModifiers || typeof sourceDefinition.statModifiers !== 'object') {
    return
  }

  const normalizedStatModifiers: Record<string, PartVariantStatModifier> = {}

  Object.entries(sourceDefinition.statModifiers).forEach(([statKey, rawModifier]) => {
    const modifier = parseVariantStatModifier(rawModifier)
    if (!modifier) {
      console.warn(`[garage] Ignoring invalid stat modifier "${statKey}" on variant "${sourceDefinition.id}".`)
      return
    }

    const baseValue = (baseDefinition as Record<string, unknown>)[statKey]
    if (typeof baseValue !== 'number' || !Number.isFinite(baseValue)) {
      console.warn(`[garage] Ignoring stat modifier "${statKey}" on variant "${sourceDefinition.id}": base stat is not numeric.`)
      return
    }

    normalizedStatModifiers[statKey] = modifier

    if (modifier.op === 'add') {
      ;(mergedDefinition as Record<string, unknown>)[statKey] = baseValue + modifier.value
      return
    }
    if (modifier.op === 'mult') {
      ;(mergedDefinition as Record<string, unknown>)[statKey] = baseValue * modifier.value
      return
    }

    ;(mergedDefinition as Record<string, unknown>)[statKey] = modifier.value
  })

  if (Object.keys(normalizedStatModifiers).length > 0) {
    mergedDefinition.statModifiers = normalizedStatModifiers
  }
}

const resolveVariantCatalog = (sourceCatalog: PartDefinition[]): PartDefinition[] => {
  const sourceById = new Map(sourceCatalog.map((definition) => [definition.id, definition] as const))
  const resolvedById = new Map<string, PartDefinition>()
  const resolvingIds = new Set<string>()

  const resolveById = (id: string): PartDefinition | null => {
    const existing = resolvedById.get(id)
    if (existing) {
      return existing
    }

    const sourceDefinition = sourceById.get(id)
    if (!sourceDefinition) {
      return null
    }

    if (resolvingIds.has(id)) {
      console.warn(`[garage] Variant cycle detected while resolving "${id}".`)
      return null
    }

    resolvingIds.add(id)

    const variantOf = typeof sourceDefinition.variantOf === 'string'
      ? sourceDefinition.variantOf.trim()
      : ''

    let resolved: PartDefinition = {
      ...sourceDefinition,
      statModifiers: sourceDefinition.statModifiers ? { ...sourceDefinition.statModifiers } : undefined
    }

    if (variantOf) {
      const baseDefinition = resolveById(variantOf)
      if (!baseDefinition) {
        console.warn(`[garage] Variant "${sourceDefinition.id}" references missing base part "${variantOf}".`)
      } else {
        resolved = {
          ...baseDefinition,
          ...sourceDefinition,
          variantOf,
          statModifiers: sourceDefinition.statModifiers ? { ...sourceDefinition.statModifiers } : undefined
        }
        applyVariantStats(baseDefinition, resolved, sourceDefinition)
      }
    }

    resolvingIds.delete(id)
    resolvedById.set(id, resolved)
    return resolved
  }

  return sourceCatalog.map((definition) => resolveById(definition.id) ?? { ...definition })
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

  if (typeof source.variantOf === 'string') {
    const variantOf = source.variantOf.trim()
    if (variantOf.length > 0) {
      normalized.variantOf = variantOf
    }
  }
  if (source.statModifiers !== undefined) {
    normalized.statModifiers = normalizeVariantStatModifiers(source.statModifiers, id)
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
  if (typeof source.meleeHitSound === 'string') {
    normalized.meleeHitSound = source.meleeHitSound
  }
  if (Array.isArray(source.chipModifiers)) {
    normalized.chipModifiers = source.chipModifiers.filter((entry): entry is string => typeof entry === 'string')
  }
  if (Array.isArray(source.effectModifiers)) {
    normalized.effectModifiers = normalizeEffectModifiers(source.effectModifiers, id)
  }

  if (source.twoHanded === true) {
    normalized.twoHanded = true
  }
  if (source.isMelee === true) {
    normalized.isMelee = true
  }
  if (source.isPassive === true) {
    normalized.isPassive = true
  }

  if (source.chipSlots !== undefined) {
    normalized.chipSlots = Math.max(0, Math.floor(parseFiniteNumber(source.chipSlots, `${id}.chipSlots`)))
  }
  if (source.computeBandWidth !== undefined) {
    normalized.computeBandWidth = Math.max(0, Math.floor(parseFiniteNumber(source.computeBandWidth, `${id}.computeBandWidth`)))
  }
  if (source.chipMemoryCost !== undefined) {
    normalized.chipMemoryCost = Math.max(0, Math.floor(parseFiniteNumber(source.chipMemoryCost, `${id}.chipMemoryCost`)))
  }

  return normalized
}

export const createGarageStore = (): GarageStore => {
  let catalog = resolveVariantCatalog(loadPartCatalog())
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
      installedChips: entry.installedChips.map((chip) => ({ ...chip }))
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
    const equippedIds = new Set([
      ...Object.values(loadout).filter((entry): entry is string => typeof entry === 'string')
    ])
    return inventory.filter((entry) => {
      const definition = getDefinition(entry.definitionId)
      return definition?.category === category && !equippedIds.has(entry.instanceId)
    })
  }

  const getEquippedInstance = (category: PartCategory): PartInstance | null => {
    const instanceId = loadout[category as keyof MechLoadout]
    if (!instanceId) {
      return null
    }
    return getInstance(instanceId)
  }

  const getComputeCapacityForEquippedComputer = (): number => {
    const equippedComputerId = loadout.Computer
    if (!equippedComputerId) {
      return 0
    }
    const equippedComputerInstance = getInstance(equippedComputerId)
    const equippedComputerDefinition = equippedComputerInstance
      ? getDefinition(equippedComputerInstance.definitionId)
      : null
    return Math.max(0, Math.floor(equippedComputerDefinition?.computeBandWidth ?? 100))
  }

  const getChipMemoryCost = (chipInstanceId: string): number => {
    const chipInstance = getInstance(chipInstanceId)
    const chipDefinition = chipInstance ? getDefinition(chipInstance.definitionId) : null
    if (!chipDefinition || chipDefinition.category !== 'Chip') {
      return 0
    }
    return Math.max(0, Math.floor(chipDefinition.chipMemoryCost ?? 0))
  }

  const findChipHostInstance = (chipInstanceId: string): PartInstance | null => {
    return inventory.find((candidate) => candidate.installedChips.some((chip) => chip.chipInstanceId === chipInstanceId)) ?? null
  }

  const getUsedComputeForEquippedComputer = (excludeChipInstanceId?: string): number => {
    const equippedComputerId = loadout.Computer
    if (!equippedComputerId) {
      return 0
    }
    const computerInstance = getInstance(equippedComputerId)
    if (!computerInstance) {
      return 0
    }
    let used = 0
    for (const installedChip of computerInstance.installedChips) {
      if (!installedChip.active) {
        continue
      }
      if (installedChip.chipInstanceId === excludeChipInstanceId) {
        continue
      }
      used += getChipMemoryCost(installedChip.chipInstanceId)
    }
    return used
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
    ;(previewLoadout as Record<string, string>)[category] = instanceId
    return callback({
      catalog: catalog.map((entry) => ({ ...entry })),
      inventory: inventory.map((entry) => ({
        ...entry,
        modifiers: [...entry.modifiers],
        installedChips: entry.installedChips.map((chip) => ({ ...chip }))
      })),
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
    delete (nextLoadout as Record<string, unknown>)[category]
    loadout = nextLoadout
    persistInventory()
    emitChange()
  }

  const getEquippedInWeaponSlot = (slot: WeaponMountSlot): PartInstance | null => {
    const instanceId = loadout[slot]
    if (!instanceId) {
      return null
    }
    return getInstance(instanceId)
  }

  const isTwoHandedWeaponEquipped = (): boolean => {
    const rhInstanceId = loadout.RightHand
    if (!rhInstanceId) {
      return false
    }
    const instance = getInstance(rhInstanceId)
    const definition = instance ? getDefinition(instance.definitionId) : null
    return !!(definition?.twoHanded && definition.category === 'HandWeapon')
  }

  const isTwoShoulderedWeaponEquipped = (): boolean => {
    const slInstanceId = loadout.ShoulderLeft
    const srInstanceId = loadout.ShoulderRight

    const slInstance = slInstanceId ? getInstance(slInstanceId) : null
    const slDefinition = slInstance ? getDefinition(slInstance.definitionId) : null
    if (slDefinition?.twoHanded && slDefinition.category === 'ShoulderWeapon') {
      return true
    }

    const srInstance = srInstanceId ? getInstance(srInstanceId) : null
    const srDefinition = srInstance ? getDefinition(srInstance.definitionId) : null
    return !!(srDefinition?.twoHanded && srDefinition.category === 'ShoulderWeapon')
  }

  const validateEquipToWeaponSlot = (slot: WeaponMountSlot, instanceId: string, callback?: (snapshot: GarageSnapshot) => EquipValidation): EquipValidation => {
    const instance = getInstance(instanceId)
    const definition = instance ? getDefinition(instance.definitionId) : null
    if (!instance || !definition) {
      return { valid: false, warnings: ['Selected part instance no longer exists.'] }
    }
    const expectedCategory = (slot === 'LeftHand' || slot === 'RightHand') ? 'HandWeapon' : 'ShoulderWeapon'
    if (definition.category !== expectedCategory) {
      return { valid: false, warnings: [`${definition.name} cannot be installed in this weapon slot.`] }
    }
    if (!callback) {
      return { valid: true, warnings: [] }
    }
    // Build preview loadout reflecting this equip action
    const previewLoadout = cloneLoadout(loadout)
    if (definition.twoHanded) {
      if (slot === 'LeftHand' || slot === 'RightHand') {
        previewLoadout.RightHand = instanceId
        delete previewLoadout.LeftHand
      } else {
        previewLoadout.ShoulderLeft = instanceId
        delete previewLoadout.ShoulderRight
      }
    } else {
      if (expectedCategory === 'HandWeapon' && isTwoHandedWeaponEquipped()) {
        delete previewLoadout.RightHand
        delete previewLoadout.LeftHand
      }
      if (expectedCategory === 'ShoulderWeapon' && isTwoShoulderedWeaponEquipped()) {
        delete previewLoadout.ShoulderLeft
        delete previewLoadout.ShoulderRight
      }
      previewLoadout[slot] = instanceId
    }
    return callback({
      catalog: catalog.map((entry) => ({ ...entry })),
      inventory: inventory.map((entry) => ({
        ...entry,
        modifiers: [...entry.modifiers],
        installedChips: entry.installedChips.map((chip) => ({ ...chip }))
      })),
      loadout: previewLoadout,
      devModeEnabled
    })
  }

  const installChipIntoPart = (hostInstanceId: string, chipInstanceId: string, slotIndex: number): ChipActivationResult => {
    const hostInstance = getInstance(hostInstanceId)
    const chipInstance = getInstance(chipInstanceId)
    const hostDefinition = hostInstance ? getDefinition(hostInstance.definitionId) : null
    const chipDefinition = chipInstance ? getDefinition(chipInstance.definitionId) : null
    if (!hostInstance || !chipInstance || !hostDefinition || !chipDefinition || chipDefinition.category !== 'Chip') {
      return { success: false, reason: 'invalid_target', message: 'Invalid host or chip instance.' }
    }

    const totalSlots = Math.max(0, Math.floor(hostDefinition.chipSlots ?? 0))
    if (totalSlots <= 0) {
      return { success: false, reason: 'invalid_target', message: 'This part has no chip slots.' }
    }
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= totalSlots) {
      return { success: false, reason: 'invalid_target', message: 'Invalid chip slot.' }
    }

    const existingHost = findChipHostInstance(chipInstanceId)
    if (existingHost) {
      return { success: false, reason: 'invalid_target', message: 'Chip is already installed in another part.' }
    }

    if (hostInstance.installedChips.some((entry) => entry.chipInstanceId === chipInstanceId)) {
      return { success: false, reason: 'invalid_target', message: 'Chip is already installed in this part.' }
    }

    if (hostInstance.installedChips.length >= totalSlots) {
      return { success: false, reason: 'invalid_target', message: 'All chip slots are already occupied.' }
    }

    const insertionIndex = Math.min(slotIndex, hostInstance.installedChips.length)
    const nextInstalled = [...hostInstance.installedChips]
    nextInstalled.splice(insertionIndex, 0, { chipInstanceId, active: false })
    hostInstance.installedChips = nextInstalled
    persistInventory()
    emitChange()
    return { success: true }
  }

  const removeChipFromPart = (hostInstanceId: string, chipInstanceId: string): ChipActivationResult => {
    const hostInstance = getInstance(hostInstanceId)
    if (!hostInstance) {
      return { success: false, reason: 'invalid_target', message: 'Invalid host part.' }
    }
    const before = hostInstance.installedChips.length
    hostInstance.installedChips = hostInstance.installedChips.filter((entry) => entry.chipInstanceId !== chipInstanceId)
    if (hostInstance.installedChips.length === before) {
      return { success: false, reason: 'invalid_target', message: 'Chip is not installed in this part.' }
    }
    persistInventory()
    emitChange()
    return { success: true }
  }

  const setChipActive = (hostInstanceId: string, chipInstanceId: string, active: boolean): ChipActivationResult => {
    const hostInstance = getInstance(hostInstanceId)
    const hostDefinition = hostInstance ? getDefinition(hostInstance.definitionId) : null
    const chipIndex = hostInstance?.installedChips.findIndex((entry) => entry.chipInstanceId === chipInstanceId) ?? -1
    if (!hostInstance || !hostDefinition || chipIndex < 0) {
      return { success: false, reason: 'invalid_target', message: 'Invalid host part or chip selection.' }
    }

    if (active) {
      const hostIsEquippedComputer = loadout.Computer === hostInstance.instanceId
      if (hostIsEquippedComputer) {
        const capacity = getComputeCapacityForEquippedComputer()
        const usedWithoutTarget = getUsedComputeForEquippedComputer(chipInstanceId)
        const targetCost = getChipMemoryCost(chipInstanceId)
        if ((usedWithoutTarget + targetCost) > capacity) {
          return {
            success: false,
            reason: 'not_enough_compute',
            message: 'Not enough memory bandwidth. Deactivate other chips to make room for this chip.'
          }
        }
      }
    }

    const existingChipState = hostInstance.installedChips[chipIndex]
    if (!existingChipState) {
      return { success: false, reason: 'invalid_target', message: 'Chip state could not be resolved.' }
    }
    hostInstance.installedChips[chipIndex] = {
      chipInstanceId: existingChipState.chipInstanceId,
      active
    }
    persistInventory()
    emitChange()
    return { success: true }
  }

  const equipToWeaponSlot = (slot: WeaponMountSlot, instanceId: string): void => {
    const instance = getInstance(instanceId)
    const definition = instance ? getDefinition(instance.definitionId) : null
    const expectedCategory = (slot === 'LeftHand' || slot === 'RightHand') ? 'HandWeapon' : 'ShoulderWeapon'
    if (!instance || !definition || definition.category !== expectedCategory) {
      throw new Error('Invalid weapon equip target.')
    }
    const nextLoadout = cloneLoadout(loadout)
    if (definition.twoHanded) {
      // Two-handed weapon occupies the primary slot and clears the other
      if (expectedCategory === 'HandWeapon') {
        nextLoadout.RightHand = instanceId
        delete nextLoadout.LeftHand
      } else {
        nextLoadout.ShoulderLeft = instanceId
        delete nextLoadout.ShoulderRight
      }
    } else {
      // If a two-handed weapon is currently in hands, clear it first
      if (expectedCategory === 'HandWeapon' && isTwoHandedWeaponEquipped()) {
        delete nextLoadout.RightHand
        delete nextLoadout.LeftHand
      }
      // If a two-shouldered weapon is currently equipped and we're equipping to a shoulder
      if (expectedCategory === 'ShoulderWeapon' && isTwoShoulderedWeaponEquipped()) {
        delete nextLoadout.ShoulderLeft
        delete nextLoadout.ShoulderRight
      }
      nextLoadout[slot] = instanceId
    }
    loadout = nextLoadout
    persistInventory()
    emitChange()
  }

  const unequipWeaponSlot = (slot: WeaponMountSlot): void => {
    const nextLoadout = cloneLoadout(loadout)
    // If unequipping the primary slot of a two-handed/two-shouldered weapon, clear both
    if ((slot === 'RightHand' || slot === 'LeftHand') && isTwoHandedWeaponEquipped()) {
      delete nextLoadout.RightHand
      delete nextLoadout.LeftHand
    } else if ((slot === 'ShoulderLeft' || slot === 'ShoulderRight') && isTwoShoulderedWeaponEquipped()) {
      delete nextLoadout.ShoulderLeft
      delete nextLoadout.ShoulderRight
    } else {
      delete nextLoadout[slot]
    }
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
    catalog = resolveVariantCatalog([...catalog, { ...definition }])
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
    catalog = resolveVariantCatalog(catalog.map((entry) => (entry.id === definitionId ? { ...nextDefinition } : entry)))
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
    getEquippedInWeaponSlot,
    getInstance,
    getDefinition,
    setDevMode,
    equipInstance,
    equipToWeaponSlot,
    unequipSlot,
    unequipWeaponSlot,
    addDefinition,
    updateDefinition,
    deleteDefinition,
    createInstanceFromDefinition,
    installChipIntoPart,
    removeChipFromPart,
    setChipActive,
    findChipHostInstance,
    validateEquip,
    validateEquipToWeaponSlot,
    isTwoHandedWeaponEquipped,
    isTwoShoulderedWeaponEquipped,
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

      catalog = resolveVariantCatalog(nextCatalog)

      const inventoryBefore = inventory.length
      inventory = inventory.filter((entry) => seenIds.has(entry.definitionId))
      const removedInventoryCount = inventoryBefore - inventory.length

      const knownInstanceIds = new Set(inventory.map((entry) => entry.instanceId))
      const nextLoadout = cloneLoadout(loadout)
      const clearedLoadoutSlots: PartCategory[] = []
      PART_CATEGORIES.forEach((category) => {
        if (category === 'HandWeapon' || category === 'ShoulderWeapon' || category === 'Chip') return
        const instanceId = (nextLoadout as Record<string, string | undefined>)[category]
        if (!instanceId) {
          return
        }
        if (!knownInstanceIds.has(instanceId)) {
          delete (nextLoadout as Record<string, unknown>)[category]
          clearedLoadoutSlots.push(category)
        }
      })
      WEAPON_MOUNT_SLOTS.forEach((slot) => {
        const instanceId = nextLoadout[slot]
        if (!instanceId) {
          return
        }
        if (!knownInstanceIds.has(instanceId)) {
          delete nextLoadout[slot]
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

export const GARAGE_CATEGORY_ORDER = PART_CATEGORIES.filter(
  (c) => c !== 'HandWeapon' && c !== 'ShoulderWeapon'
) as Array<Exclude<typeof PART_CATEGORIES[number], 'HandWeapon' | 'ShoulderWeapon'>>
