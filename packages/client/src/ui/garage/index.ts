import { createPartCard } from '../components/PartCard.js'
import { getFinalPartStats } from '../../systems/parts/statResolver.js'
import { CATEGORY_LABELS, WEAPON_MOUNT_SLOT_LABELS, WEAPON_MOUNT_SLOTS, type GarageSnapshot, type MechLoadout, type PartCategory, type PartDefinition, type PartInstance, type WeaponMountSlot } from '../../data/parts/types.js'
import { GARAGE_CATEGORY_ORDER, type EquipValidation, type GarageStore } from './store.js'

const createDefinitionPreviewStats = (definition: PartDefinition) => ({
  ...definition,
  currentIntegrity: definition.integrity,
  integrityRatio: 1,
  damagePenaltyMultiplier: 1,
  modifierSummary: [],
  installedChips: []
})

const buildCatalogExportFileName = (): string => {
  const stamp = new Date().toISOString().slice(0, 10)
  return `garage-catalog-${stamp}.json`
}

const downloadTextFile = (fileName: string, content: string): void => {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export type GarageViewElements = {
  root: HTMLElement
  slotList: HTMLElement
  title: HTMLElement
  content: HTMLElement
  summary: HTMLElement
}

export type GarageViewController = {
  render: () => void
  setActiveCategory: (category: PartCategory | WeaponMountSlot) => void
}

export type GarageViewOptions = {
  store: GarageStore
  elements: GarageViewElements
  getEquipValidation: (category: PartCategory, instanceId: string, preview: GarageSnapshot) => EquipValidation
  onLoadoutChanged: (snapshot: GarageSnapshot) => void
}

type ModalFocusOptions = {
  returnFocusTo?: HTMLElement | null
  fallbackFocusTarget?: HTMLElement | null
  focusScope?: HTMLElement | null
}

const cloneDefinition = (definition: PartDefinition): PartDefinition => ({
  ...definition,
  passiveBonuses: [...(definition.passiveBonuses ?? [])],
  activeAbilities: [...(definition.activeAbilities ?? [])],
  specialEffects: [...(definition.specialEffects ?? [])]
})

const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const selector = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',')

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((element) => {
    return !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true' && element.offsetParent !== null
  })
}

const renderModal = (modalContent: HTMLElement, focusOptions: ModalFocusOptions = {}): Promise<boolean> => {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'garage-modal-overlay'

    const modal = document.createElement('div')
    modal.className = 'garage-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.appendChild(modalContent)
    overlay.appendChild(modal)

    const headingElement = modal.querySelector('h1, h2, h3, h4, h5, h6') as HTMLElement | null
    if (headingElement) {
      if (headingElement.id.length === 0) {
        headingElement.id = `garageModalTitle-${Math.random().toString(36).slice(2, 10)}`
      }
      headingElement.tabIndex = -1
      modal.setAttribute('aria-labelledby', headingElement.id)
    }

    const getInitialFocusTarget = (): HTMLElement | null => {
      if (headingElement) {
        return headingElement
      }
      return getFocusableElements(modal)[0] ?? null
    }

    let closed = false

    const close = (result: boolean): void => {
      if (closed) {
        return
      }
      closed = true
      overlay.remove()
      resolve(result)

      window.requestAnimationFrame(() => {
        const preferredTarget = focusOptions.returnFocusTo
        const fallbackTarget = focusOptions.fallbackFocusTarget
        const scope = focusOptions.focusScope
        const isWithinScope = (target: HTMLElement): boolean => {
          if (!(scope instanceof HTMLElement)) {
            return true
          }
          return scope.contains(target)
        }

        if (preferredTarget instanceof HTMLElement && preferredTarget.isConnected && isWithinScope(preferredTarget)) {
          preferredTarget.focus()
          return
        }

        if (fallbackTarget instanceof HTMLElement && fallbackTarget.isConnected && isWithinScope(fallbackTarget)) {
          fallbackTarget.tabIndex = -1
          fallbackTarget.focus()
          return
        }

        if (scope instanceof HTMLElement) {
          scope.tabIndex = -1
          scope.focus()
        }
      })
    }

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close(false)
      }
    })

    overlay.addEventListener('garage:close', ((event: Event) => {
      const closeEvent = event as CustomEvent<boolean>
      close(!!closeEvent.detail)
    }) as EventListener)

    overlay.addEventListener('keydown', (event) => {
      if (event.code === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close(false)
        return
      }

      if (event.code !== 'Tab') {
        return
      }

      const focusableElements = getFocusableElements(modal)
      if (focusableElements.length === 0) {
        event.preventDefault()
        headingElement?.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const activeInsideModal = activeElement ? modal.contains(activeElement) : false

      if (event.shiftKey) {
        if (!activeInsideModal || activeElement === firstElement) {
          event.preventDefault()
          lastElement?.focus()
        }
        return
      }

      if (!activeInsideModal || activeElement === lastElement) {
        event.preventDefault()
        firstElement?.focus()
      }
    })

    overlay.addEventListener('focusin', (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement) || modal.contains(target)) {
        return
      }
      const nextFocus = getInitialFocusTarget()
      if (nextFocus) {
        nextFocus.focus()
      }
    })

    const cancelButtons = modal.querySelectorAll('[data-garage-modal-cancel="true"]')
    cancelButtons.forEach((button) => {
      button.addEventListener('click', () => close(false))
    })

    const confirmButtons = modal.querySelectorAll('[data-garage-modal-confirm="true"]')
    confirmButtons.forEach((button) => {
      button.addEventListener('click', () => close(true))
    })

    document.body.appendChild(overlay)
    window.requestAnimationFrame(() => {
      getInitialFocusTarget()?.focus()
    })
  })
}

const buildConfirmationButtons = (): HTMLElement => {
  const row = document.createElement('div')
  row.className = 'garage-modal-actions'

  const cancelButton = document.createElement('button')
  cancelButton.type = 'button'
  cancelButton.className = 'garage-action-button neutral'
  cancelButton.dataset.garageModalCancel = 'true'
  cancelButton.textContent = 'No'
  row.appendChild(cancelButton)

  const confirmButton = document.createElement('button')
  confirmButton.type = 'button'
  confirmButton.className = 'garage-action-button primary'
  confirmButton.dataset.garageModalConfirm = 'true'
  confirmButton.textContent = 'Yes'
  row.appendChild(confirmButton)

  return row
}

const createEquipModalContent = (
  category: PartCategory,
  nextDefinition: PartDefinition,
  nextInstance: PartInstance,
  currentInstance: PartInstance | null,
  warnings: string[],
  currentDefinition: PartDefinition | null
): HTMLElement => {
  const wrapper = document.createElement('div')
  wrapper.className = 'garage-modal-content'

  const title = document.createElement('h2')
  title.className = 'garage-modal-title'
  title.textContent = currentInstance ? 'Are you sure you want to swap this part?' : 'Are you sure you want to install this part?'
  wrapper.appendChild(title)

  if (warnings.length > 0) {
    const warningBlock = document.createElement('ul')
    warningBlock.className = 'garage-modal-warning-list'
    warnings.forEach((warning) => {
      const item = document.createElement('li')
      item.textContent = warning
      warningBlock.appendChild(item)
    })
    wrapper.appendChild(warningBlock)
  }

  const comparison = document.createElement('div')
  comparison.className = 'garage-modal-compare'
  comparison.appendChild(createPartCard({
    category,
    title: nextDefinition.name,
    subtitle: `${CATEGORY_LABELS[category]} candidate`,
    definition: nextDefinition,
    instance: nextInstance,
    stats: getFinalPartStats(nextInstance.instanceId),
    statusText: `Integrity ${nextInstance.currentIntegrity}/${nextDefinition.integrity}`
  }))

  if (currentInstance && currentDefinition) {
    comparison.appendChild(createPartCard({
      category,
      title: currentDefinition.name,
      subtitle: 'Currently equipped',
      definition: currentDefinition,
      instance: currentInstance,
      stats: getFinalPartStats(currentInstance.instanceId),
      statusText: `Integrity ${currentInstance.currentIntegrity}/${currentDefinition.integrity}`
    }))
  }

  wrapper.appendChild(comparison)
  wrapper.appendChild(buildConfirmationButtons())
  return wrapper
}

type WeaponOccupancyEntry = {
  instance: PartInstance
  definition: PartDefinition
  occupiedSlots: WeaponMountSlot[]
}

const formatWeaponSlotList = (slots: WeaponMountSlot[]): string => {
  const labels = slots.map((slot) => WEAPON_MOUNT_SLOT_LABELS[slot])
  if (labels.length <= 1) {
    return labels[0] ?? 'None'
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`
  }
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

const createShoulderEquipModalContent = (
  slot: WeaponMountSlot,
  nextDefinition: PartDefinition,
  nextInstance: PartInstance,
  warnings: string[],
  occupiedEntries: WeaponOccupancyEntry[]
): HTMLElement => {
  const wrapper = document.createElement('div')
  wrapper.className = 'garage-modal-content'

  const title = document.createElement('h2')
  title.className = 'garage-modal-title'
  title.textContent = 'Confirm shoulder equip'
  wrapper.appendChild(title)

  const body = document.createElement('p')
  body.className = 'garage-modal-body'
  const occupiedSlots = occupiedEntries.flatMap((entry) => entry.occupiedSlots)
  body.textContent = occupiedSlots.length > 0
    ? `Target slot: ${WEAPON_MOUNT_SLOT_LABELS[slot]}. Currently occupied shoulder slots: ${formatWeaponSlotList(occupiedSlots)}. Equipping this part will unequip currently equipped shoulder part(s) as needed and return them to the shoulder parts garage list.`
    : `Target slot: ${WEAPON_MOUNT_SLOT_LABELS[slot]}. No shoulder slots are currently occupied.`
  wrapper.appendChild(body)

  if (warnings.length > 0) {
    const warningBlock = document.createElement('ul')
    warningBlock.className = 'garage-modal-warning-list'
    warnings.forEach((warning) => {
      const item = document.createElement('li')
      item.textContent = warning
      warningBlock.appendChild(item)
    })
    wrapper.appendChild(warningBlock)
  }

  const comparison = document.createElement('div')
  comparison.className = 'garage-modal-compare'
  comparison.appendChild(createPartCard({
    category: 'ShoulderWeapon',
    title: nextDefinition.name,
    subtitle: `${WEAPON_MOUNT_SLOT_LABELS[slot]} candidate`,
    definition: nextDefinition,
    instance: nextInstance,
    stats: getFinalPartStats(nextInstance.instanceId),
    statusText: `Integrity ${nextInstance.currentIntegrity}/${nextDefinition.integrity}`
  }))

  occupiedEntries.forEach((entry) => {
    comparison.appendChild(createPartCard({
      category: 'ShoulderWeapon',
      title: entry.definition.name,
      subtitle: `Currently equipped in ${formatWeaponSlotList(entry.occupiedSlots)}`,
      definition: entry.definition,
      instance: entry.instance,
      stats: getFinalPartStats(entry.instance.instanceId),
      statusText: `Integrity ${entry.instance.currentIntegrity}/${entry.definition.integrity}`
    }))
  })

  wrapper.appendChild(comparison)
  wrapper.appendChild(buildConfirmationButtons())
  return wrapper
}

const createDeleteModalContent = (definition: PartDefinition): HTMLElement => {
  const wrapper = document.createElement('div')
  wrapper.className = 'garage-modal-content'

  const title = document.createElement('h2')
  title.className = 'garage-modal-title'
  title.textContent = `Delete ${definition.name}?`
  wrapper.appendChild(title)

  const body = document.createElement('p')
  body.className = 'garage-modal-body'
  body.textContent = 'Referenced definitions will be marked deprecated instead of being removed.'
  wrapper.appendChild(body)

  wrapper.appendChild(buildConfirmationButtons())
  return wrapper
}

const buildDefinitionDraft = (definition?: PartDefinition, forcedCategory?: PartCategory): PartDefinition => {
  return cloneDefinition(definition ?? {
    id: '',
    name: '',
    category: forcedCategory ?? 'Head',
    integrity: 100,
    weight: 0,
    PDEF: 0,
    EDEF: 0,
    energyDrain: 0,
    passiveBonuses: [],
    activeAbilities: [],
    specialEffects: []
  })
}

const getEditableKeys = (category: PartCategory): string[] => {
  const shared = ['id', 'name', 'integrity', 'weight', 'PDEF', 'EDEF', 'energyDrain']
  switch (category) {
    case 'Head':
      return [...shared, 'range']
    case 'Computer':
      return [...shared, 'lockOn']
    case 'Core':
      return [...shared, 'stability']
    case 'Generator':
      return [...shared, 'energyCapacity', 'powerOutput']
    case 'ThermalRegulator':
      return [...shared, 'heatDissipation', 'heatCapacity', 'emergencyCooling']
    case 'LeftArm':
      return [...shared, 'meleeDamage']
    case 'RightArm':
      return [...shared, 'accuracy']
    case 'Utility1':
      return [...shared, 'sensorStrength']
    case 'Utility2':
      return [...shared, 'heatGeneration', 'liftCapacity', 'flightType', 'rotorCount', 'verticalTakeoffTime', 'flightStability', 'speedModifier', 'energyUse']
    case 'HandWeapon':
      return [...shared, 'damagePerShot', 'fireRateCooldownSeconds', 'projectileCount', 'spreadDegrees', 'bulletSpeed', 'clipSize', 'weaponReach', 'meleeContactTimeMs', 'accuracy', 'effectiveRange', 'stability', 'meleeDamage', 'meleeHitSound', 'twoHanded', 'isMelee', 'isPassive']
    case 'ShoulderWeapon':
      return [...shared, 'damagePerShot', 'fireRateCooldownSeconds', 'projectileCount', 'spreadDegrees', 'bulletSpeed', 'clipSize', 'weaponReach', 'meleeContactTimeMs', 'accuracy', 'effectiveRange', 'stability', 'meleeDamage', 'meleeHitSound', 'twoHanded', 'isPassive']
    default:
      return shared
  }
}

const WEAPON_SLOT_TO_CATEGORY: Record<WeaponMountSlot, PartCategory> = {
  LeftHand: 'HandWeapon',
  RightHand: 'HandWeapon',
  ShoulderLeft: 'ShoulderWeapon',
  ShoulderRight: 'ShoulderWeapon'
}

const createDefinitionEditor = (
  category: PartCategory,
  onSubmit: (definition: PartDefinition) => void,
  existing?: PartDefinition
): HTMLElement => {
  const draft = buildDefinitionDraft(existing, category)
  const form = document.createElement('form')
  form.className = 'garage-definition-form'

  const title = document.createElement('h2')
  title.className = 'garage-modal-title'
  title.textContent = existing ? `Edit ${existing.name}` : `Add ${CATEGORY_LABELS[category]}`
  form.appendChild(title)

  getEditableKeys(category).forEach((key) => {
    const row = document.createElement('label')
    row.className = 'garage-definition-row'

    const labelText = document.createElement('span')
    labelText.textContent = key
    row.appendChild(labelText)

    const isBooleanField = key === 'twoHanded' || key === 'isMelee' || key === 'isPassive'
    const isTextField = key === 'id' || key === 'name' || key === 'flightType' || key === 'meleeHitSound'

    const input = document.createElement('input')
    if (isBooleanField) {
      input.type = 'checkbox'
      input.checked = !!(draft as Record<string, unknown>)[key]
      input.addEventListener('change', () => {
        ;(draft as Record<string, unknown>)[key] = input.checked
      })
    } else {
      input.type = isTextField ? 'text' : 'number'
      input.step = '0.01'
      input.value = String((draft as Record<string, unknown>)[key] ?? '')
      input.addEventListener('input', () => {
        ;(draft as Record<string, unknown>)[key] = input.type === 'number'
          ? Number(input.value || 0)
          : input.value
      })
    }
    row.appendChild(input)
    form.appendChild(row)
  })

  const submitRow = document.createElement('div')
  submitRow.className = 'garage-modal-actions'

  const cancelButton = document.createElement('button')
  cancelButton.type = 'button'
  cancelButton.className = 'garage-action-button neutral'
  cancelButton.dataset.garageModalCancel = 'true'
  cancelButton.textContent = 'Cancel'
  submitRow.appendChild(cancelButton)

  const submitButton = document.createElement('button')
  submitButton.type = 'submit'
  submitButton.className = 'garage-action-button primary'
  submitButton.textContent = existing ? 'Save' : 'Create'
  submitRow.appendChild(submitButton)
  form.appendChild(submitRow)

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    onSubmit({ ...draft, category })
    form.dispatchEvent(new CustomEvent<boolean>('garage:close', { bubbles: true, detail: true }))
  })

  return form
}

export const createGarageView = (options: GarageViewOptions): GarageViewController => {
  let activeSlotId: PartCategory | WeaponMountSlot = 'Head'
  const categoryButtons = new Map<string, HTMLButtonElement>()
  options.elements.title.tabIndex = -1

  const isWeaponSlot = (id: PartCategory | WeaponMountSlot): id is WeaponMountSlot => {
    return WEAPON_MOUNT_SLOTS.includes(id as WeaponMountSlot)
  }

  const getSlotLabel = (id: PartCategory | WeaponMountSlot): string => {
    if (isWeaponSlot(id)) {
      return WEAPON_MOUNT_SLOT_LABELS[id]
    }
    return CATEGORY_LABELS[id]
  }

  const getShoulderOccupancyEntries = (): WeaponOccupancyEntry[] => {
    const entries: WeaponOccupancyEntry[] = []
    const leftInstance = options.store.getEquippedInWeaponSlot('ShoulderLeft')
    const rightInstance = options.store.getEquippedInWeaponSlot('ShoulderRight')
    const leftDefinition = leftInstance ? options.store.getDefinition(leftInstance.definitionId) : null
    const rightDefinition = rightInstance ? options.store.getDefinition(rightInstance.definitionId) : null

    if (leftInstance && leftDefinition?.category === 'ShoulderWeapon' && leftDefinition.twoHanded === true) {
      return [{
        instance: leftInstance,
        definition: leftDefinition,
        occupiedSlots: ['ShoulderLeft', 'ShoulderRight']
      }]
    }

    if (rightInstance && rightDefinition?.category === 'ShoulderWeapon' && rightDefinition.twoHanded === true) {
      return [{
        instance: rightInstance,
        definition: rightDefinition,
        occupiedSlots: ['ShoulderLeft', 'ShoulderRight']
      }]
    }

    if (leftInstance && leftDefinition?.category === 'ShoulderWeapon') {
      entries.push({
        instance: leftInstance,
        definition: leftDefinition,
        occupiedSlots: ['ShoulderLeft']
      })
    }

    if (rightInstance && rightDefinition?.category === 'ShoulderWeapon') {
      entries.push({
        instance: rightInstance,
        definition: rightDefinition,
        occupiedSlots: ['ShoulderRight']
      })
    }

    return entries
  }

  const getDisplayedEquippedInWeaponSlot = (slot: WeaponMountSlot): WeaponOccupancyEntry | null => {
    const direct = options.store.getEquippedInWeaponSlot(slot)
    if (slot !== 'ShoulderLeft' && slot !== 'ShoulderRight') {
      if (!direct) {
        return null
      }
      const definition = options.store.getDefinition(direct.definitionId)
      if (!definition) {
        return null
      }
      return {
        instance: direct,
        definition,
        occupiedSlots: [slot]
      }
    }

    const shoulderEntries = getShoulderOccupancyEntries()
    return shoulderEntries.find((entry) => entry.occupiedSlots.includes(slot)) ?? null
  }

  const activateCategory = (category: PartCategory | WeaponMountSlot): void => {
    if (activeSlotId === category) {
      return
    }
    activeSlotId = category
    render()
  }

  const renderCategoryButtons = (): void => {
    if (categoryButtons.size === 0) {
      options.elements.slotList.innerHTML = ''
      options.elements.slotList.setAttribute('role', 'tablist')
      options.elements.slotList.setAttribute('aria-label', 'Garage part categories')

      const allSlots: Array<PartCategory | WeaponMountSlot> = [
        ...GARAGE_CATEGORY_ORDER,
        ...WEAPON_MOUNT_SLOTS
      ]

      allSlots.forEach((slotId) => {
        const listItem = document.createElement('li')
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'pause-loadout-slot-button garage-category-button'
        button.dataset.viewId = slotId
        button.textContent = getSlotLabel(slotId)
        button.setAttribute('role', 'tab')
        button.setAttribute('aria-controls', 'pauseLoadoutContent')
        button.addEventListener('click', () => {
          activateCategory(slotId)
        })
        button.addEventListener('keydown', (event) => {
          if (event.code === 'Space' || event.code === 'Enter') {
            event.preventDefault()
            event.stopPropagation()
            activateCategory(slotId)
          }
        })
        listItem.appendChild(button)
        options.elements.slotList.appendChild(listItem)
        categoryButtons.set(slotId, button)
      })
    }

    const allSlots: Array<PartCategory | WeaponMountSlot> = [
      ...GARAGE_CATEGORY_ORDER,
      ...WEAPON_MOUNT_SLOTS
    ]
    allSlots.forEach((slotId) => {
      const button = categoryButtons.get(slotId)
      if (!button) {
        return
      }
      const selected = activeSlotId === slotId
      button.setAttribute('aria-selected', selected ? 'true' : 'false')
      button.tabIndex = selected ? 0 : -1
    })
  }

  const renderSummary = (snapshot: GarageSnapshot): void => {
    let equippedDefinition: PartDefinition | null = null
    if (isWeaponSlot(activeSlotId)) {
      const equipped = options.store.getEquippedInWeaponSlot(activeSlotId)
      equippedDefinition = equipped ? options.store.getDefinition(equipped.definitionId) : null
    } else {
      const equipped = options.store.getEquippedInstance(activeSlotId)
      equippedDefinition = equipped ? options.store.getDefinition(equipped.definitionId) : null
    }
    const modeLabel = snapshot.devModeEnabled ? 'Developer catalog mode' : 'Garage inventory mode'
    const slotLabel = getSlotLabel(activeSlotId)
    const equippedLabel = equippedDefinition ? `Equipped: ${equippedDefinition.name}` : `${slotLabel} slot is empty`
    options.elements.summary.textContent = `${modeLabel}. ${equippedLabel}.`
  }

  const showEditorModal = async (slotId: PartCategory | WeaponMountSlot, definition?: PartDefinition): Promise<void> => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const editorCategory: PartCategory = isWeaponSlot(slotId) ? WEAPON_SLOT_TO_CATEGORY[slotId] : slotId
    const content = createDefinitionEditor(editorCategory, (nextDefinition) => {
      if (definition) {
        options.store.updateDefinition(definition.id, nextDefinition)
      } else {
        options.store.addDefinition(nextDefinition)
      }
    }, definition)
    await renderModal(content, {
      returnFocusTo: opener,
      fallbackFocusTarget: options.elements.title,
      focusScope: options.elements.root
    })
  }

  const tryEquipInstance = async (slotId: PartCategory | WeaponMountSlot, instance: PartInstance): Promise<void> => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (isWeaponSlot(slotId)) {
      const validation = options.store.validateEquipToWeaponSlot(slotId, instance.instanceId, (preview) => {
        const weaponCategory = WEAPON_SLOT_TO_CATEGORY[slotId]
        return options.getEquipValidation(weaponCategory, instance.instanceId, preview)
      })
      if (!validation.valid) {
        return
      }
      const currentInstance = options.store.getEquippedInWeaponSlot(slotId)
      const nextDefinition = options.store.getDefinition(instance.definitionId)
      const currentDefinition = currentInstance ? options.store.getDefinition(currentInstance.definitionId) : null
      if (!nextDefinition) {
        return
      }
      const modalContent = (
        slotId === 'ShoulderLeft' || slotId === 'ShoulderRight'
      )
        ? createShoulderEquipModalContent(slotId, nextDefinition, instance, validation.warnings, getShoulderOccupancyEntries())
        : createEquipModalContent(WEAPON_SLOT_TO_CATEGORY[slotId], nextDefinition, instance, currentInstance, validation.warnings, currentDefinition)
      const confirmed = await renderModal(modalContent, {
        returnFocusTo: opener,
        fallbackFocusTarget: options.elements.title,
        focusScope: options.elements.root
      })
      if (!confirmed) {
        return
      }
      options.store.equipToWeaponSlot(slotId, instance.instanceId)
      options.onLoadoutChanged(options.store.getSnapshot())
    } else {
      const validation = options.store.validateEquip(slotId, instance.instanceId, (preview) => options.getEquipValidation(slotId, instance.instanceId, preview))
      if (!validation.valid) {
        return
      }
      const currentInstance = options.store.getEquippedInstance(slotId)
      const nextDefinition = options.store.getDefinition(instance.definitionId)
      const currentDefinition = currentInstance ? options.store.getDefinition(currentInstance.definitionId) : null
      if (!nextDefinition) {
        return
      }
      const confirmed = await renderModal(createEquipModalContent(slotId, nextDefinition, instance, currentInstance, validation.warnings, currentDefinition), {
        returnFocusTo: opener,
        fallbackFocusTarget: options.elements.title,
        focusScope: options.elements.root
      })
      if (!confirmed) {
        return
      }
      options.store.equipInstance(slotId, instance.instanceId)
      options.onLoadoutChanged(options.store.getSnapshot())
    }
  }

  const renderInventoryMode = (slotId: PartCategory | WeaponMountSlot): void => {
    const content = options.elements.content
    content.innerHTML = ''

    if (isWeaponSlot(slotId)) {
      renderWeaponSlotInventoryMode(slotId)
      return
    }

    const category = slotId
    const equippedInstance = options.store.getEquippedInstance(category)
    const equippedDefinition = equippedInstance ? options.store.getDefinition(equippedInstance.definitionId) : null
    const header = document.createElement('div')
    header.className = 'garage-pane-header'
    header.textContent = equippedDefinition
      ? `Currently equipped: ${equippedDefinition.name}`
      : `${CATEGORY_LABELS[category]} slot is empty`
    content.appendChild(header)

    if (equippedInstance && equippedDefinition) {
      content.appendChild(createPartCard({
        category,
        title: equippedDefinition.name,
        subtitle: 'Equipped on mech',
        definition: equippedDefinition,
        instance: equippedInstance,
        stats: getFinalPartStats(equippedInstance.instanceId),
        statusText: `Integrity ${equippedInstance.currentIntegrity}/${equippedDefinition.integrity}`,
        actions: [
          {
            label: 'Unequip Part',
            tone: 'neutral',
            onClick: () => {
              options.store.unequipSlot(category)
              options.onLoadoutChanged(options.store.getSnapshot())
            }
          }
        ]
      }))
    }

    const instances = options.store.getGarageInstancesByCategory(category)
    if (instances.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'garage-empty-state'
      empty.textContent = 'No owned parts in this category.'
      content.appendChild(empty)
      return
    }

    instances.forEach((instance) => {
      const definition = options.store.getDefinition(instance.definitionId)
      if (!definition) {
        return
      }
      const preview = options.store.validateEquip(category, instance.instanceId, (snapshot) => options.getEquipValidation(category, instance.instanceId, snapshot))
      content.appendChild(createPartCard({
        category,
        title: definition.name,
        subtitle: `Garage item ${instance.instanceId.slice(0, 8)}`,
        definition,
        instance,
        stats: getFinalPartStats(instance.instanceId),
        statusText: `Integrity ${instance.currentIntegrity}/${definition.integrity}`,
        warnings: preview.warnings,
        actions: [
          {
            label: 'Equip Part to Mech',
            tone: 'primary',
            onClick: () => {
              void tryEquipInstance(category, instance)
            }
          }
        ]
      }))
    })
  }

  const renderWeaponSlotInventoryMode = (slot: WeaponMountSlot): void => {
    const content = options.elements.content
    const weaponCategory = WEAPON_SLOT_TO_CATEGORY[slot]
    const slotLabel = WEAPON_MOUNT_SLOT_LABELS[slot]

    // Left hand remains blocked by right-hand two-handed weapons to preserve current hand-slot behavior.
    const isTwoHandedBlocked = slot === 'LeftHand' && options.store.isTwoHandedWeaponEquipped()

    if (isTwoHandedBlocked) {
      const primarySlot: WeaponMountSlot = 'RightHand'
      const primaryInstance = options.store.getEquippedInWeaponSlot(primarySlot)
      const primaryDefinition = primaryInstance ? options.store.getDefinition(primaryInstance.definitionId) : null
      const header = document.createElement('div')
      header.className = 'garage-pane-header'
      header.textContent = primaryDefinition
        ? `Occupied by ${primaryDefinition.name} (Two-Handed)`
        : `${slotLabel} occupied`
      content.appendChild(header)
      const notice = document.createElement('div')
      notice.className = 'garage-empty-state'
      notice.textContent = 'This slot is occupied by the weapon in the paired slot. Unequip or replace the two-handed weapon to use this slot.'
      content.appendChild(notice)
      return
    }

    const equippedEntry = getDisplayedEquippedInWeaponSlot(slot)
    const equippedInstance = equippedEntry?.instance ?? null
    const equippedDefinition = equippedEntry?.definition ?? null

    const header = document.createElement('div')
    header.className = 'garage-pane-header'
    header.textContent = equippedDefinition
      ? `Currently equipped: ${equippedDefinition.name}`
      : `${slotLabel} is empty`
    content.appendChild(header)

    if (equippedInstance && equippedDefinition) {
      const occupiedLabel = equippedEntry && equippedEntry.occupiedSlots.length > 1
        ? `Equipped in ${formatWeaponSlotList(equippedEntry.occupiedSlots)}`
        : `Equipped in ${slotLabel}`
      content.appendChild(createPartCard({
        category: weaponCategory,
        title: equippedDefinition.name,
        subtitle: occupiedLabel,
        definition: equippedDefinition,
        instance: equippedInstance,
        stats: getFinalPartStats(equippedInstance.instanceId),
        statusText: `Integrity ${equippedInstance.currentIntegrity}/${equippedDefinition.integrity}`,
        actions: [
          {
            label: 'Unequip Weapon',
            tone: 'neutral',
            onClick: () => {
              if (slot === 'ShoulderLeft' || slot === 'ShoulderRight') {
                const occupiedSlots = equippedEntry?.occupiedSlots ?? [slot]
                const unequipSlot = occupiedSlots.includes(slot)
                  ? slot
                  : (occupiedSlots[0] ?? slot)
                options.store.unequipWeaponSlot(unequipSlot)
              } else {
                options.store.unequipWeaponSlot(slot)
              }
              options.onLoadoutChanged(options.store.getSnapshot())
            }
          }
        ]
      }))
    }

    const instances = options.store.getGarageInstancesByCategory(weaponCategory)
    if (instances.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'garage-empty-state'
      empty.textContent = 'No owned weapons in this category.'
      content.appendChild(empty)
      return
    }

    instances.forEach((instance) => {
      const definition = options.store.getDefinition(instance.definitionId)
      if (!definition) {
        return
      }
      const preview = options.store.validateEquipToWeaponSlot(slot, instance.instanceId, (snapshot) => {
        return options.getEquipValidation(weaponCategory, instance.instanceId, snapshot)
      })
      content.appendChild(createPartCard({
        category: weaponCategory,
        title: definition.name,
        subtitle: `Garage item ${instance.instanceId.slice(0, 8)}${definition.twoHanded ? ' · Two-Handed' : ''}${definition.isMelee ? ' · Melee' : ''}`,
        definition,
        instance,
        stats: getFinalPartStats(instance.instanceId),
        statusText: `Integrity ${instance.currentIntegrity}/${definition.integrity}`,
        warnings: preview.warnings,
        actions: [
          {
            label: `Equip to ${slotLabel}`,
            tone: 'primary',
            onClick: () => {
              void tryEquipInstance(slot, instance)
            }
          }
        ]
      }))
    })
  }

  const renderDeveloperMode = (slotId: PartCategory | WeaponMountSlot): void => {
    const category: PartCategory = isWeaponSlot(slotId) ? WEAPON_SLOT_TO_CATEGORY[slotId] : slotId
    const content = options.elements.content
    content.innerHTML = ''

    const actionsRow = document.createElement('div')
    actionsRow.className = 'garage-pane-header'

    const exportButton = document.createElement('button')
    exportButton.type = 'button'
    exportButton.className = 'garage-action-button neutral'
    exportButton.textContent = 'Export Catalog JSON'
    exportButton.addEventListener('click', () => {
      const rawCatalog = options.store.exportCatalogJson()
      downloadTextFile(buildCatalogExportFileName(), rawCatalog)
    })
    actionsRow.appendChild(exportButton)

    const importInput = document.createElement('input')
    importInput.type = 'file'
    importInput.accept = '.json,application/json'
    importInput.hidden = true

    const importButton = document.createElement('button')
    importButton.type = 'button'
    importButton.className = 'garage-action-button neutral'
    importButton.textContent = 'Import Catalog JSON'
    importButton.addEventListener('click', () => {
      importInput.value = ''
      importInput.click()
    })

    importInput.addEventListener('change', async () => {
      const selectedFile = importInput.files?.[0]
      if (!selectedFile) {
        return
      }

      try {
        const rawText = await selectedFile.text()
        const result = options.store.importCatalogJson(rawText)
        const slotSummary = result.clearedLoadoutSlots.length > 0
          ? `Cleared loadout slots: ${result.clearedLoadoutSlots.join(', ')}.`
          : 'No loadout slots were cleared.'
        window.alert(
          `Catalog imported: ${result.definitionCount} definitions. Removed inventory items: ${result.removedInventoryCount}. ${slotSummary}`
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Import failed.'
        window.alert(message)
      }
    })

    actionsRow.appendChild(importButton)
    actionsRow.appendChild(importInput)
    content.appendChild(actionsRow)

    const addButton = document.createElement('button')
    addButton.type = 'button'
    addButton.className = 'garage-action-button primary garage-add-button'
    addButton.textContent = 'Add New Part'
    addButton.addEventListener('click', () => {
      void showEditorModal(slotId)
    })
    content.appendChild(addButton)

    const definitions = options.store.getDefinitionsByCategory(category)
    if (definitions.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'garage-empty-state'
      empty.textContent = 'No definitions in this category yet.'
      content.appendChild(empty)
      return
    }

    definitions.forEach((definition) => {
      const card = createPartCard({
        category,
        title: definition.name,
        subtitle: definition.deprecated ? 'Deprecated catalog entry' : 'Catalog definition',
        definition,
        instance: null,
        stats: createDefinitionPreviewStats(definition),
        statusText: definition.deprecated ? 'Deprecated' : 'Active definition',
        actions: [
          {
            label: 'Edit',
            tone: 'primary',
            onClick: () => {
              void showEditorModal(slotId, definition)
            }
          },
          {
            label: 'Delete',
            tone: 'danger',
            onClick: async () => {
              const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
              const confirmed = await renderModal(createDeleteModalContent(definition), {
                returnFocusTo: opener,
                fallbackFocusTarget: options.elements.title,
                focusScope: options.elements.root
              })
              if (!confirmed) {
                return
              }
              options.store.deleteDefinition(definition.id)
            }
          }
        ]
      })
      content.appendChild(card)
    })
  }

  const render = (): void => {
    const snapshot = options.store.getSnapshot()
    options.elements.root.dataset.garageMode = snapshot.devModeEnabled ? 'dev' : 'garage'
    options.elements.title.textContent = snapshot.devModeEnabled
      ? `${getSlotLabel(activeSlotId)} Catalog`
      : `${getSlotLabel(activeSlotId)} Garage`

    renderCategoryButtons()
    renderSummary(snapshot)

    if (snapshot.devModeEnabled) {
      renderDeveloperMode(activeSlotId)
      return
    }

  renderInventoryMode(activeSlotId)
  }

  return {
    render,
    setActiveCategory: (category) => {
      activateCategory(category)
    }
  }
}
