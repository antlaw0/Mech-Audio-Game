import type { AudioController, InputState } from './types.js'
import { getControlBinding, isReservedDebugNumpadCode, type ControlActionId } from './controls.js'
import { isEditableEventTarget, isTypingContextActive } from './keyboard-focus.js'

function shouldPreventDefault(code: string): boolean {
  return ['Space'].includes(code)
} // end function shouldPreventDefault

function matchesBoundControl(event: KeyboardEvent, actionId: ControlActionId): boolean {
  if (isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
    return false
  }
  return event.code === getControlBinding(actionId)
} // end function matchesBoundControl

export function bindInput(
  input: InputState,
  audio: AudioController,
  isInputBlocked: () => boolean = () => false
): void {
  const keys: Record<string, boolean> = {}
  const shouldHandleDirectionalSnap = (event: KeyboardEvent): boolean => {
    return false
  } // end function shouldHandleDirectionalSnap

  const resumeAudioOnInteraction = (): void => {
    void audio.ensureAudio()
  } // end function resumeAudioOnInteraction

  document.addEventListener('pointerdown', resumeAudioOnInteraction)
  document.addEventListener('touchstart', resumeAudioOnInteraction, { passive: true })

  document.addEventListener('keydown', async (event) => {
    void audio.ensureAudio()

    if (isTypingContextActive(event)) {
      return
    } // end if typing in editable field

    if (matchesBoundControl(event, 'toggleWorldMap') && !event.repeat) {
      input.toggleWorldMapPending = true
      event.preventDefault()
      return
    } // end if world map toggle key

    if (isInputBlocked()) {
      if (shouldPreventDefault(event.code)) {
        event.preventDefault()
      } // end if prevent default while blocked
      return
    } // end if input blocked

    await audio.ensureAudio()

    if (shouldHandleDirectionalSnap(event)) {
      if (!keys[event.code]) {
        keys[event.code] = true
        input.snapLeftPending = event.code === 'ArrowLeft'
        input.snapRightPending = event.code === 'ArrowRight'
      } // end if directional snap chord not already held
      event.preventDefault()
      return
    } // end if ctrl directional snap chord

    if (!keys[event.code]) {
      keys[event.code] = true

      if (event.code === 'AltLeft' || event.code === 'AltRight') {
        input.subsystemSelectModifier = true
      } // end if subsystem selection modifier key pressed

      if (matchesBoundControl(event, 'moveForward')) {
        input.moveForward = true
      } // end if moveForward

      if (matchesBoundControl(event, 'moveBack')) {
        input.moveBack = true
      } // end if moveBack

      if (matchesBoundControl(event, 'strafeLeft')) {
        input.strafeLeft = true
      } // end if strafeLeft

      if (matchesBoundControl(event, 'strafeRight')) {
        input.strafeRight = true
      } // end if strafeRight

      if (matchesBoundControl(event, 'turnLeft')) {
        input.turnLeft = true
      } // end if turnLeft

      if (matchesBoundControl(event, 'turnRight')) {
        input.turnRight = true
      } // end if turnRight

      if (matchesBoundControl(event, 'lookUp')) {
        input.lookUp = true
        if (input.lookDown) {
          input.lookUp = false
          input.lookDown = false
          input.pitchResetPending = true
        } // end if pitch reset key combo detected
      } // end if lookUp

      if (matchesBoundControl(event, 'lookDown')) {
        input.lookDown = true
        if (input.lookUp) {
          input.lookUp = false
          input.lookDown = false
          input.pitchResetPending = true
        } // end if pitch reset key combo detected
      } // end if lookDown

      if (matchesBoundControl(event, 'fire')) {
        input.fireHeld = true
        input.firePending = true
      } // end if fire

      if (matchesBoundControl(event, 'reload')) {
        event.preventDefault()
        input.reloadPending = true
      } // end if reload

      if (matchesBoundControl(event, 'melee')) {
        input.meleePending = true
      } // end if melee

      if (matchesBoundControl(event, 'flightToggle')) {
        input.flightTogglePending = true
      } // end if flightToggle

      if (matchesBoundControl(event, 'sonarPing')) {
        input.sonarPingPending = true
      } // end if sonarPing



      if (matchesBoundControl(event, 'selectRightHand')) {
        input.selectedWeaponSlot = 'RightHand'
      } // end if selectRightHand

      if (matchesBoundControl(event, 'selectLeftHand')) {
        input.selectedWeaponSlot = 'LeftHand'
      } // end if selectLeftHand

      if (matchesBoundControl(event, 'selectShoulderLeft')) {
        input.selectedWeaponSlot = 'ShoulderLeft'
      } // end if selectShoulderLeft

      if (matchesBoundControl(event, 'selectShoulderRight')) {
        input.selectedWeaponSlot = 'ShoulderRight'
      } // end if selectShoulderRight

      if (event.code === 'Numpad1' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
        input.spawnTankPending = true
      } // end if Numpad1

      if (event.code === 'Numpad2' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
        input.spawnStrikerPending = true
      } // end if Numpad2

      if (event.code === 'Numpad3' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
        input.spawnBrutePending = true
      } // end if Numpad3

      if (event.code === 'Numpad4' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
        input.spawnHelicopterPending = true
      } // end if Numpad4

      if (event.code === 'Numpad5' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
        input.spawnBruiserPending = true
      } // end if Numpad5

      if (event.code === 'NumpadDecimal' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
        input.spawnTestDummyPending = true
      } // end if NumpadDecimal

      if (event.code === 'NumpadDivide' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
        input.refillEpPending = true
      } // end if NumpadDivide

      if (event.code === 'NumpadMultiply' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
        input.refillHpPending = true
      } // end if NumpadMultiply

      if (matchesBoundControl(event, 'speakEnergy')) {
        input.speakEpPending = true
      } // end if speakEnergy

      if (matchesBoundControl(event, 'speakHealth')) {
        input.speakHpPending = true
      } // end if speakHealth

      if (matchesBoundControl(event, 'speakCoordinates')) {
        input.speakCoordsPending = true
      } // end if speakCoordinates

      if (matchesBoundControl(event, 'speakDestination')) {
        input.speakDestinationPending = true
      } // end if speakDestination

      if (matchesBoundControl(event, 'boostToggle')) {
        input.boostTogglePending = true
      } // end if boostToggle

      if (matchesBoundControl(event, 'toggleProximityAudio')) {
        const enabled = audio.toggleCategory('proximity')
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(`proximity ${enabled ? 'on' : 'off'}`))
      } // end if toggleProximityAudio

      if (matchesBoundControl(event, 'toggleObjectsAudio')) {
        const enabled = audio.toggleCategory('objects')
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(`objects ${enabled ? 'on' : 'off'}`))
      } // end if toggleObjectsAudio

      if (matchesBoundControl(event, 'toggleEnemiesAudio')) {
        const enabled = audio.toggleCategory('enemies')
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(`enemies ${enabled ? 'on' : 'off'}`))
      } // end if toggleEnemiesAudio

      if (matchesBoundControl(event, 'toggleNavigationAudio')) {
        const enabled = audio.toggleCategory('navigation')
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(`navigation ${enabled ? 'on' : 'off'}`))
      } // end if toggleNavigationAudio

      if ((matchesBoundControl(event, 'turnLeft') || matchesBoundControl(event, 'turnRight')) && audio.isAudioStarted()) {
        audio.startServo()
      } // end if turn key and audio started
    } // end if key was not held

    if (shouldPreventDefault(event.code)) {
      event.preventDefault()
    } // end if prevent default
  }) // end keydown listener

  document.addEventListener('keyup', (event) => {
    if (isEditableEventTarget(event)) {
      return
    } // end if typing in editable field

    keys[event.code] = false

    if (event.code === 'AltLeft' || event.code === 'AltRight') {
      input.subsystemSelectModifier = !!keys.AltLeft || !!keys.AltRight
    } // end if subsystem selection modifier key released

    if (matchesBoundControl(event, 'moveForward')) {
      input.moveForward = false
    } // end if moveForward

    if (matchesBoundControl(event, 'moveBack')) {
      input.moveBack = false
    } // end if moveBack

    if (matchesBoundControl(event, 'strafeLeft')) {
      input.strafeLeft = false
    } // end if strafeLeft

    if (matchesBoundControl(event, 'strafeRight')) {
      input.strafeRight = false
    } // end if strafeRight

    if (matchesBoundControl(event, 'turnLeft')) {
      input.turnLeft = false
    } // end if turnLeft

    if (matchesBoundControl(event, 'turnRight')) {
      input.turnRight = false
    } // end if turnRight

    if (matchesBoundControl(event, 'lookUp')) {
      input.lookUp = false
    } // end if lookUp

    if (matchesBoundControl(event, 'lookDown')) {
      input.lookDown = false
    } // end if lookDown

    if (matchesBoundControl(event, 'fire')) {
      input.fireHeld = false
    } // end if fire

    if (matchesBoundControl(event, 'melee')) {
      input.meleePending = false
    } // end if melee

    if (matchesBoundControl(event, 'flightToggle')) {
      input.flightTogglePending = false
    } // end if flightToggle

    if (matchesBoundControl(event, 'sonarPing')) {
      input.sonarPingPending = false
    } // end if sonarPing



    if (
      matchesBoundControl(event, 'selectRightHand') ||
      matchesBoundControl(event, 'selectLeftHand') ||
      matchesBoundControl(event, 'selectShoulderLeft') ||
      matchesBoundControl(event, 'selectShoulderRight')
    ) {
      input.selectedWeaponSlot = null
    } // end if Digit key released

    if (event.code === 'Numpad1' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
      input.spawnTankPending = false
    } // end if Numpad1

    if (event.code === 'Numpad2' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
      input.spawnStrikerPending = false
    } // end if Numpad2

    if (event.code === 'Numpad3' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
      input.spawnBrutePending = false
    } // end if Numpad3

    if (event.code === 'Numpad4' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
      input.spawnHelicopterPending = false
    } // end if Numpad4

    if (event.code === 'Numpad5' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
      input.spawnBruiserPending = false
    } // end if Numpad5

    if (event.code === 'NumpadDecimal' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
      input.spawnTestDummyPending = false
    } // end if NumpadDecimal

    if (event.code === 'NumpadDivide' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
      input.refillEpPending = false
    } // end if NumpadDivide

    if (event.code === 'NumpadMultiply' && isReservedDebugNumpadCode(event.code, event.getModifierState('NumLock'))) {
      input.refillHpPending = false
    } // end if NumpadMultiply

    if (matchesBoundControl(event, 'speakEnergy')) {
      input.speakEpPending = false
    } // end if speakEnergy

    if (matchesBoundControl(event, 'speakHealth')) {
      input.speakHpPending = false
    } // end if speakHealth

    if (matchesBoundControl(event, 'speakCoordinates')) {
      input.speakCoordsPending = false
    } // end if speakCoordinates

    if (matchesBoundControl(event, 'speakDestination')) {
      input.speakDestinationPending = false
    } // end if speakDestination

    if (
      (
        matchesBoundControl(event, 'turnLeft') ||
        matchesBoundControl(event, 'turnRight') ||
        matchesBoundControl(event, 'lookUp') ||
        matchesBoundControl(event, 'lookDown')
      ) &&
      !input.turnLeft &&
      !input.turnRight &&
      !input.lookUp &&
      !input.lookDown
    ) {
      audio.stopServo()
    } // end if turning keys all released
  }) // end keyup listener
} // end function bindInput
