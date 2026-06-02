export type ControlActionId =
  | 'toggleWorldMap'
  | 'moveForward'
  | 'moveBack'
  | 'strafeLeft'
  | 'strafeRight'
  | 'turnLeft'
  | 'turnRight'
  | 'lookUp'
  | 'lookDown'
  | 'recenterPitch'
  | 'jump'
  | 'fire'
  | 'reload'
  | 'melee'
  | 'flightToggle'
  | 'sonarPing'
  | 'selectRightHand'
  | 'selectLeftHand'
  | 'selectShoulderLeft'
  | 'selectShoulderRight'
  | 'speakEnergy'
  | 'speakHealth'
  | 'speakCoordinates'
  | 'speakDestination'
  | 'boostToggle'
  | 'toggleProximityAudio'
  | 'toggleObjectsAudio'
  | 'toggleEnemiesAudio'
  | 'toggleNavigationAudio'

export interface ControlBindingDefinition {
  id: ControlActionId
  label: string
  description: string
  section: 'Navigation' | 'Movement' | 'Combat' | 'Loadout' | 'Status' | 'Audio'
  defaultCode: string
} // end interface ControlBindingDefinition

export type ControlBindings = Record<ControlActionId, string>

const STORAGE_KEY = 'mech.testMap.controlBindings.v2'

const CONTROL_BINDING_DEFINITIONS: readonly ControlBindingDefinition[] = [
  { id: 'toggleWorldMap', label: 'World map', description: 'Toggle the world map overlay.', section: 'Navigation', defaultCode: 'F2' },
  { id: 'moveForward', label: 'Move forward', description: 'Drive or walk forward.', section: 'Movement', defaultCode: 'KeyW' },
  { id: 'moveBack', label: 'Move backward', description: 'Reverse movement.', section: 'Movement', defaultCode: 'KeyS' },
  { id: 'strafeLeft', label: 'Strafe left', description: 'Move left without turning.', section: 'Movement', defaultCode: 'KeyA' },
  { id: 'strafeRight', label: 'Strafe right', description: 'Move right without turning.', section: 'Movement', defaultCode: 'KeyD' },
  { id: 'turnLeft', label: 'Turn left', description: 'Rotate the mech left.', section: 'Movement', defaultCode: 'Numpad4' },
  { id: 'turnRight', label: 'Turn right', description: 'Rotate the mech right.', section: 'Movement', defaultCode: 'Numpad6' },
  { id: 'lookUp', label: 'Look up', description: 'Pitch the camera upward.', section: 'Movement', defaultCode: 'Numpad8' },
  { id: 'lookDown', label: 'Look down', description: 'Pitch the camera downward.', section: 'Movement', defaultCode: 'Numpad2' },
  { id: 'recenterPitch', label: 'Recenter pitch', description: 'Quickly recenter pitch toward horizon.', section: 'Movement', defaultCode: 'Numpad5' },
  { id: 'jump', label: 'Jump', description: 'Leap toward flight altitude, then fall back to support.', section: 'Movement', defaultCode: 'Space' },
  { id: 'fire', label: 'Fire weapon', description: 'Fire the active weapon.', section: 'Combat', defaultCode: 'Numpad0' },
  { id: 'reload', label: 'Reload', description: 'Reload the active ranged weapon.', section: 'Combat', defaultCode: 'Tab' },
  { id: 'melee', label: 'Melee attack', description: 'Use the melee weapon.', section: 'Combat', defaultCode: 'KeyR' },
  { id: 'flightToggle', label: 'Toggle flight', description: 'Switch between grounded and flight mode.', section: 'Combat', defaultCode: 'KeyF' },
  { id: 'sonarPing', label: 'Sonar ping', description: 'Emit a sonar pulse.', section: 'Navigation', defaultCode: 'KeyE' },
  { id: 'selectRightHand', label: 'Equip right hand', description: 'Switch to the right-hand weapon slot.', section: 'Loadout', defaultCode: 'Digit1' },
  { id: 'selectLeftHand', label: 'Equip left hand', description: 'Switch to the left-hand weapon slot.', section: 'Loadout', defaultCode: 'Digit2' },
  { id: 'selectShoulderLeft', label: 'Equip left shoulder', description: 'Switch to the left shoulder weapon slot.', section: 'Loadout', defaultCode: 'Digit3' },
  { id: 'selectShoulderRight', label: 'Equip right shoulder', description: 'Switch to the right shoulder weapon slot.', section: 'Loadout', defaultCode: 'Digit4' },
  { id: 'speakEnergy', label: 'Speak energy', description: 'Read out current EP.', section: 'Status', defaultCode: 'KeyG' },
  { id: 'speakHealth', label: 'Speak health', description: 'Read out current HP.', section: 'Status', defaultCode: 'KeyH' },
  { id: 'speakCoordinates', label: 'Speak coordinates', description: 'Read out the current world position.', section: 'Status', defaultCode: 'KeyT' },
  { id: 'speakDestination', label: 'Speak destination', description: 'Read out the current destination.', section: 'Status', defaultCode: 'KeyN' },
  { id: 'boostToggle', label: 'Toggle boost', description: 'Toggle mech boost mode.', section: 'Movement', defaultCode: 'KeyQ' },
  { id: 'toggleProximityAudio', label: 'Toggle proximity audio', description: 'Enable or disable proximity cues.', section: 'Audio', defaultCode: 'KeyZ' },
  { id: 'toggleObjectsAudio', label: 'Toggle object audio', description: 'Enable or disable object cues.', section: 'Audio', defaultCode: 'KeyX' },
  { id: 'toggleEnemiesAudio', label: 'Toggle enemy audio', description: 'Enable or disable enemy cues.', section: 'Audio', defaultCode: 'KeyC' },
  { id: 'toggleNavigationAudio', label: 'Toggle navigation audio', description: 'Enable or disable navigation cues.', section: 'Audio', defaultCode: 'KeyV' }
] as const

function createDefaultBindings(): ControlBindings {
  return CONTROL_BINDING_DEFINITIONS.reduce((bindings, definition) => {
    bindings[definition.id] = definition.defaultCode
    return bindings
  }, {} as ControlBindings)
} // end function createDefaultBindings

function isStoredBindings(value: unknown): value is Partial<Record<ControlActionId, string>> {
  return typeof value === 'object' && value !== null
} // end function isStoredBindings

function loadBindings(): ControlBindings {
  const defaults = createDefaultBindings()
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return defaults
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY)
  if (!rawValue) {
    return defaults
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (!isStoredBindings(parsed)) {
      return defaults
    }

    const nextBindings = { ...defaults }
    for (const definition of CONTROL_BINDING_DEFINITIONS) {
      const storedCode = parsed[definition.id]
      if (typeof storedCode === 'string' && storedCode.length > 0) {
        nextBindings[definition.id] = storedCode
      }
    }
    return nextBindings
  } catch {
    return defaults
  }
} // end function loadBindings

function persistBindings(): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(controlBindings))
} // end function persistBindings

const controlBindings: ControlBindings = loadBindings()

export function getControlBindingDefinitions(): readonly ControlBindingDefinition[] {
  return CONTROL_BINDING_DEFINITIONS
} // end function getControlBindingDefinitions

export function getControlBindings(): ControlBindings {
  return { ...controlBindings }
} // end function getControlBindings

export function getControlBinding(actionId: ControlActionId): string {
  return controlBindings[actionId]
} // end function getControlBinding

export function setControlBinding(actionId: ControlActionId, nextCode: string): ControlBindings {
  const trimmedCode = nextCode.trim()
  if (!trimmedCode) {
    return getControlBindings()
  }

  const previousCode = controlBindings[actionId]
  if (previousCode === trimmedCode) {
    return getControlBindings()
  }

  const swappedAction = CONTROL_BINDING_DEFINITIONS.find((definition) => {
    return definition.id !== actionId && controlBindings[definition.id] === trimmedCode
  })

  controlBindings[actionId] = trimmedCode
  if (swappedAction) {
    controlBindings[swappedAction.id] = previousCode
  }

  persistBindings()
  return getControlBindings()
} // end function setControlBinding

export function isReservedDebugNumpadCode(code: string, numLockEnabled: boolean): boolean {
  return numLockEnabled && code.startsWith('Numpad')
} // end function isReservedDebugNumpadCode

export function formatControlCode(code: string): string {
  const aliases: Record<string, string> = {
    Space: 'Space',
    Tab: 'Tab',
    Backquote: '`',
    Escape: 'Esc',
    ArrowLeft: 'Left Arrow',
    ArrowRight: 'Right Arrow',
    ArrowUp: 'Up Arrow',
    ArrowDown: 'Down Arrow',
    NumpadDecimal: 'Numpad .',
    NumpadDivide: 'Numpad /',
    NumpadMultiply: 'Numpad *',
    NumpadSubtract: 'Numpad -',
    NumpadAdd: 'Numpad +',
    NumpadEnter: 'Numpad Enter',
    CapsLock: 'Caps Lock',
    ShiftLeft: 'Left Shift',
    ShiftRight: 'Right Shift',
    ControlLeft: 'Left Ctrl',
    ControlRight: 'Right Ctrl',
    AltLeft: 'Left Alt',
    AltRight: 'Right Alt'
  }

  if (aliases[code]) {
    return aliases[code]
  }
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3)
  }
  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5)
  }
  if (/^F[0-9]{1,2}$/.test(code)) {
    return code
  }
  if (/^Numpad[0-9]$/.test(code)) {
    return `Numpad ${code.slice(6)}`
  }
  return code.replace(/([a-z])([A-Z])/g, '$1 $2')
} // end function formatControlCode