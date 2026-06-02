import {
  CATEGORY_LABELS,
  type PartCategory,
  type PartDefinition,
  type PartInstance,
  type ResolvedInstalledChip,
  type ResolvedPartStats
} from '../../data/parts/types.js'

export type PartCardAction = {
  label: string
  tone?: 'primary' | 'neutral' | 'danger'
  onClick: () => void
}

export type PartCardViewModel = {
  category: PartCategory
  title: string
  subtitle?: string
  definition: PartDefinition
  instance?: PartInstance | null
  stats: ResolvedPartStats
  statusText?: string
  warnings?: string[]
  actions?: PartCardAction[]
  chipSection?: PartCardChipSectionViewModel
}

export type PartCardChipSlotViewModel = {
  slotIndex: number
  chip: ResolvedInstalledChip | null
  onToggleActive?: () => void
  onRemoveChip?: () => void
  onInsertChip?: () => void
}

export type PartCardChipSectionViewModel = {
  slotCount: number
  computeUsed: number
  computeCapacity: number
  slots: PartCardChipSlotViewModel[]
}

const PART_STAT_LABELS: Record<string, string> = {
  integrity: 'Base Integrity',
  currentIntegrity: 'Current Integrity',
  weight: 'Weight',
  PDEF: 'PDEF',
  EDEF: 'EDEF',
  energyDrain: 'Energy Drain',
  energyCapacity: 'Energy Capacity',
  powerOutput: 'Power Output',
  heatGeneration: 'Heat Generation',
  heatDissipation: 'Cooling Rate',
  heatCapacity: 'Max Heat',
  emergencyCooling: 'Emergency Cooling',
  liftCapacity: 'Lift Capacity',
  rotorCount: 'Rotor Count',
  verticalTakeoffTime: 'Takeoff Time',
  flightStability: 'Flight Stability',
  speedModifier: 'Speed Modifier',
  energyUse: 'Energy Use',
  range: 'Range',
  lockOn: 'Lock On',
  computeBandWidth: 'Compute Bandwidth (CU)',
  chipSlots: 'Chip Slots',
  chipMemoryCost: 'Memory Cost (CU)',
  stability: 'Stability',
  meleeDamage: 'Melee Damage',
  accuracy: 'Accuracy',
  sensorStrength: 'Sensor Strength',
  damagePerShot: 'Damage / Shot',
  fireRateCooldownSeconds: 'Fire Rate (s)',
  meleeHitSound: 'Melee Hit Sound',
  projectileCount: 'Projectiles / Shot',
  projectileType: 'Projectile Type',
  spreadDegrees: 'Spread (deg)',
  bulletSpeed: 'Projectile Speed',
  clipSize: 'Clip Size',
  weaponReach: 'Weapon Reach',
  meleeContactTimeMs: 'Melee Contact Time (ms)',
  damageType: 'Damage Type',
  firingMode: 'Firing Mode',
  horizontalLockAngle: 'Horizontal Lock Angle (deg)',
  verticalLockAngle: 'Vertical Lock Angle (deg)',
  effectiveRange: 'Effective Range',
  ammoConsumedPerShot: 'Ammo / Shot',
  energyPerShot: 'Energy / Shot',
  twoHanded: 'Two-Handed',
  isMelee: 'Melee Weapon'
}

const getCategoryStats = (category: PartCategory): string[] => {
  switch (category) {
    case 'Head':
      return ['currentIntegrity', 'weight', 'PDEF', 'EDEF', 'energyDrain', 'range']
    case 'Computer':
      return ['currentIntegrity', 'weight', 'PDEF', 'EDEF', 'energyDrain', 'lockOn', 'computeBandWidth', 'chipSlots']
    case 'Core':
      return ['currentIntegrity', 'weight', 'PDEF', 'EDEF', 'energyDrain', 'stability']
    case 'Generator':
      return ['currentIntegrity', 'weight', 'PDEF', 'EDEF', 'energyDrain', 'energyCapacity', 'powerOutput']
    case 'ThermalRegulator':
      return ['currentIntegrity', 'weight', 'PDEF', 'EDEF', 'energyDrain', 'heatDissipation', 'heatCapacity', 'emergencyCooling']
    case 'LeftArm':
      return ['currentIntegrity', 'weight', 'PDEF', 'EDEF', 'energyDrain', 'meleeDamage']
    case 'RightArm':
      return ['currentIntegrity', 'weight', 'PDEF', 'EDEF', 'energyDrain', 'accuracy']
    case 'Utility1':
      return ['currentIntegrity', 'weight', 'PDEF', 'EDEF', 'energyDrain', 'sensorStrength']
    case 'Utility2':
      return ['currentIntegrity', 'weight', 'PDEF', 'EDEF', 'energyDrain', 'liftCapacity', 'speedModifier', 'energyUse']
    case 'HandWeapon':
      return [
        'currentIntegrity',
        'weight',
        'PDEF',
        'EDEF',
        'energyDrain',
        'damagePerShot',
        'fireRateCooldownSeconds',
        'projectileCount',
        'spreadDegrees',
        'bulletSpeed',
        'clipSize',
        'weaponReach',
        'meleeContactTimeMs',
        'stability',
        'meleeDamage',
        'meleeHitSound',
        'energyPerShot',
        'ammoConsumedPerShot',
        'firingMode',
        'projectileType',
        'damageType',
        'twoHanded',
        'isMelee'
      ]
    case 'ShoulderWeapon':
      return [
        'currentIntegrity',
        'weight',
        'PDEF',
        'EDEF',
        'energyDrain',
        'damagePerShot',
        'fireRateCooldownSeconds',
        'projectileCount',
        'spreadDegrees',
        'bulletSpeed',
        'clipSize',
        'weaponReach',
        'meleeContactTimeMs',
        'stability',
        'meleeDamage',
        'meleeHitSound',
        'energyPerShot',
        'ammoConsumedPerShot',
        'firingMode',
        'projectileType',
        'damageType',
        'horizontalLockAngle',
        'verticalLockAngle',
        'twoHanded',
        'isMelee'
      ]
    case 'Chip':
      return ['chipMemoryCost']
    default:
      return ['currentIntegrity', 'weight', 'PDEF', 'EDEF', 'energyDrain']
  }
}

const formatStatValue = (value: unknown): string => {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }
  if (typeof value === 'string') {
    return value
  }
  return 'N/A'
}

export const createPartCard = (model: PartCardViewModel): HTMLElement => {
  const card = document.createElement('article')
  card.className = 'garage-part-card'

  const header = document.createElement('div')
  header.className = 'garage-part-card-header'

  const title = document.createElement('h2')
  title.className = 'garage-part-card-title'
  title.textContent = model.title
  header.appendChild(title)

  const meta = document.createElement('div')
  meta.className = 'garage-part-card-meta'
  meta.textContent = model.subtitle ?? CATEGORY_LABELS[model.category]
  header.appendChild(meta)

  card.appendChild(header)

  if (model.statusText) {
    const status = document.createElement('div')
    status.className = 'garage-part-card-status'
    status.textContent = model.statusText
    card.appendChild(status)
  }

  const statList = document.createElement('dl')
  statList.className = 'garage-part-card-stats'
  getCategoryStats(model.category).forEach((statKey) => {
    const statValue = model.stats[statKey as keyof ResolvedPartStats]
    if (statValue === undefined) {
      return
    }
    const term = document.createElement('dt')
    term.textContent = PART_STAT_LABELS[statKey] ?? statKey
    const value = document.createElement('dd')
    value.textContent = formatStatValue(statValue)
    statList.appendChild(term)
    statList.appendChild(value)
  })
  card.appendChild(statList)

  const extras: string[] = []
  if (model.definition.passiveBonuses && model.definition.passiveBonuses.length > 0) {
    extras.push(`Passive: ${model.definition.passiveBonuses.join('; ')}`)
  }
  if (model.definition.activeAbilities && model.definition.activeAbilities.length > 0) {
    extras.push(`Active: ${model.definition.activeAbilities.join('; ')}`)
  }
  if (model.stats.modifierSummary.length > 0) {
    extras.push(`Modifiers: ${model.stats.modifierSummary.join('; ')}`)
  }
  if (model.stats.installedChips.length > 0) {
    extras.push(`Chips: ${model.stats.installedChips.join(', ')}`)
  }

  if (extras.length > 0) {
    const extrasBlock = document.createElement('div')
    extrasBlock.className = 'garage-part-card-extras'
    extrasBlock.textContent = extras.join(' | ')
    card.appendChild(extrasBlock)
  }

  if (model.chipSection && model.chipSection.slotCount > 0) {
    const chipSection = document.createElement('div')
    chipSection.className = 'garage-chip-section'

    const chipHeader = document.createElement('h3')
    chipHeader.className = 'garage-chip-section-header'
    chipHeader.textContent = `Chip Slots: ${model.chipSection.slotCount} | Compute: ${model.chipSection.computeUsed}/${model.chipSection.computeCapacity} CU`
    chipSection.appendChild(chipHeader)

    const slotList = document.createElement('div')
    slotList.className = 'garage-chip-slot-list'

    model.chipSection.slots.forEach((slot) => {
      const slotCard = document.createElement('div')
      slotCard.className = 'garage-chip-slot-card'

      const slotTitle = document.createElement('h4')
      slotTitle.className = 'garage-chip-slot-title'
      slotTitle.textContent = `Slot ${slot.slotIndex + 1}`
      slotCard.appendChild(slotTitle)

      if (!slot.chip) {
        const emptyText = document.createElement('div')
        emptyText.className = 'garage-chip-slot-empty'
        emptyText.textContent = 'Chip slot is empty.'
        slotCard.appendChild(emptyText)
      } else {
        const chipTitle = document.createElement('div')
        chipTitle.className = 'garage-chip-slot-chip-name'
        chipTitle.textContent = slot.chip.chipName
        slotCard.appendChild(chipTitle)

        const chipMeta = document.createElement('div')
        chipMeta.className = 'garage-chip-slot-meta'
        const stateLabel = slot.chip.active ? (slot.chip.supportedByCompute ? 'Active' : 'Active (Unsupported)') : 'Deactivated'
        chipMeta.textContent = `Memory: ${slot.chip.memoryCost} CU | State: ${stateLabel}`
        slotCard.appendChild(chipMeta)

        const modifierList = document.createElement('ul')
        modifierList.className = 'garage-chip-slot-modifiers'
        if (slot.chip.modifiers.length > 0) {
          slot.chip.modifiers.forEach((modifier) => {
            const item = document.createElement('li')
            item.textContent = modifier
            modifierList.appendChild(item)
          })
        } else {
          const item = document.createElement('li')
          item.textContent = 'No modifiers listed.'
          modifierList.appendChild(item)
        }
        slotCard.appendChild(modifierList)
      }

      const actionRow = document.createElement('div')
      actionRow.className = 'garage-chip-slot-actions'
      if (slot.chip && slot.onToggleActive) {
        const toggleButton = document.createElement('button')
        toggleButton.type = 'button'
        toggleButton.className = 'garage-action-button neutral'
        toggleButton.textContent = slot.chip.active ? 'Deactivate Chip' : 'Activate Chip'
        toggleButton.addEventListener('click', () => slot.onToggleActive?.())
        actionRow.appendChild(toggleButton)
      }
      if (slot.chip && slot.onRemoveChip) {
        const removeButton = document.createElement('button')
        removeButton.type = 'button'
        removeButton.className = 'garage-action-button neutral'
        removeButton.textContent = 'Remove Chip'
        removeButton.addEventListener('click', () => slot.onRemoveChip?.())
        actionRow.appendChild(removeButton)
      }
      if (!slot.chip && slot.onInsertChip) {
        const insertButton = document.createElement('button')
        insertButton.type = 'button'
        insertButton.className = 'garage-action-button primary'
        insertButton.textContent = 'Insert Chip'
        insertButton.addEventListener('click', () => slot.onInsertChip?.())
        actionRow.appendChild(insertButton)
      }
      if (actionRow.childElementCount > 0) {
        slotCard.appendChild(actionRow)
      }

      slotList.appendChild(slotCard)
    })

    chipSection.appendChild(slotList)
    card.appendChild(chipSection)
  }

  if (model.warnings && model.warnings.length > 0) {
    const warningList = document.createElement('ul')
    warningList.className = 'garage-part-card-warnings'
    model.warnings.forEach((warning) => {
      const item = document.createElement('li')
      item.textContent = warning
      warningList.appendChild(item)
    })
    card.appendChild(warningList)
  }

  if (model.actions && model.actions.length > 0) {
    const actionRow = document.createElement('div')
    actionRow.className = 'garage-part-card-actions'
    model.actions.forEach((actionModel) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `garage-action-button ${actionModel.tone ?? 'neutral'}`
      button.textContent = actionModel.label
      button.addEventListener('click', () => actionModel.onClick())
      actionRow.appendChild(button)
    })
    card.appendChild(actionRow)
  }

  return card
}
