import {
  PART_DEFINITION_NUMERIC_KEYS,
  type PartDefinition,
  type PartInstance,
  type ResolvedInstalledChip,
  type ResolvedPartStats
} from '../../data/parts/types.js'

let definitionLookup: (definitionId: string) => PartDefinition | null = () => null
let instanceLookup: (instanceId: string) => PartInstance | null = () => null

export const configurePartStatResolver = (options: {
  getDefinition: (definitionId: string) => PartDefinition | null
  getInstance: (instanceId: string) => PartInstance | null
}): void => {
  definitionLookup = options.getDefinition
  instanceLookup = options.getInstance
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value))
}

const getDamagePenaltyMultiplier = (currentIntegrity: number, maxIntegrity: number): number => {
  const ratio = clamp(currentIntegrity / Math.max(1, maxIntegrity), 0, 1)
  return clamp(0.35 + (ratio * 0.65), 0.35, 1)
}

const applyDamagePenalty = (definition: PartDefinition, stats: ResolvedPartStats): void => {
  const penaltyKeys: Array<keyof PartDefinition> = [
    'PDEF',
    'EDEF',
    'energyCapacity',
    'powerOutput',
    'heatDissipation',
    'liftCapacity'
  ]

  penaltyKeys.forEach((key) => {
    const value = stats[key]
    if (typeof value === 'number') {
      ;(stats as Record<string, unknown>)[key] = Number((value * stats.damagePenaltyMultiplier).toFixed(3))
    }
  })

  if (typeof definition.speedModifier === 'number') {
    stats.speedModifier = Number((definition.speedModifier * (0.85 + (stats.damagePenaltyMultiplier * 0.15))).toFixed(3))
  }
}

export const getFinalPartStats = (instanceId: string): ResolvedPartStats => {
  const instance = instanceLookup(instanceId)
  if (!instance) {
    throw new Error(`Unknown part instance: ${instanceId}`)
  }

  const definition = definitionLookup(instance.definitionId)
  if (!definition) {
    throw new Error(`Unknown part definition: ${instance.definitionId}`)
  }

  const currentIntegrity = clamp(instance.currentIntegrity, 0, definition.integrity)
  const integrityRatio = clamp(currentIntegrity / Math.max(1, definition.integrity), 0, 1)
  const damagePenaltyMultiplier = getDamagePenaltyMultiplier(currentIntegrity, definition.integrity)
  const chipComputeCapacity = Math.max(0, Math.floor(definition.computeBandWidth ?? 0))
  let chipComputeUsed = 0
  const resolvedInstalledChips: ResolvedInstalledChip[] = []
  for (const installedChip of instance.installedChips) {
    const chipInstance = instanceLookup(installedChip.chipInstanceId)
    if (!chipInstance) {
      continue
    }
    const chipDefinition = definitionLookup(chipInstance.definitionId)
    if (!chipDefinition || chipDefinition.category !== 'Chip') {
      continue
    }
    const memoryCost = Math.max(0, Math.floor(chipDefinition.chipMemoryCost ?? 0))
    const canSupport = installedChip.active
      ? (chipComputeUsed + memoryCost) <= chipComputeCapacity
      : false
    if (canSupport) {
      chipComputeUsed += memoryCost
    }
    resolvedInstalledChips.push({
      chipInstanceId: chipInstance.instanceId,
      chipDefinitionId: chipDefinition.id,
      chipName: chipDefinition.name,
      memoryCost,
      modifiers: [...(chipDefinition.chipModifiers ?? [])],
      active: installedChip.active,
      supportedByCompute: canSupport
    })
  }

  const stats: ResolvedPartStats = {
    ...definition,
    instanceId,
    currentIntegrity,
    integrityRatio,
    damagePenaltyMultiplier,
    modifierSummary: [],
    installedChips: resolvedInstalledChips.map((entry) => entry.chipName),
    installedChipStates: resolvedInstalledChips,
    chipSlotCount: Math.max(0, Math.floor(definition.chipSlots ?? 0)),
    chipComputeUsed,
    chipComputeCapacity
  }

  instance.modifiers.forEach((modifier) => {
    if (modifier.type === 'special') {
      stats.modifierSummary.push(`${modifier.id}: ${modifier.stat} special`)
      return
    }

    if (!PART_DEFINITION_NUMERIC_KEYS.includes(modifier.stat as typeof PART_DEFINITION_NUMERIC_KEYS[number])) {
      return
    }

    const statKey = modifier.stat as keyof ResolvedPartStats
    const currentValue = stats[statKey]
    if (typeof currentValue !== 'number') {
      return
    }

    if (modifier.type === 'stat_add') {
      ;(stats as Record<string, unknown>)[modifier.stat] = Number((currentValue + modifier.value).toFixed(3))
      stats.modifierSummary.push(`${modifier.stat} +${modifier.value}`)
      return
    }

    const multiplier = 1 + modifier.value
    ;(stats as Record<string, unknown>)[modifier.stat] = Number((currentValue * multiplier).toFixed(3))
    stats.modifierSummary.push(`${modifier.stat} x${multiplier.toFixed(3)}`)
  })

  applyDamagePenalty(definition, stats)
  return stats
}
