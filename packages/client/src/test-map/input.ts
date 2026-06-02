import type { AudioController, InputState } from './types.js'
import { getControlBinding, type ControlActionId } from './controls.js'
import { isEditableEventTarget, isTypingContextActive } from './keyboard-focus.js'

function shouldPreventDefault(code: string): boolean {
  return ['Space'].includes(code)
} // end function shouldPreventDefault

function matchesBoundControl(event: KeyboardEvent, actionId: ControlActionId): boolean {
  return event.code === getControlBinding(actionId)
} // end function matchesBoundControl

export function bindInput(
  input: InputState,
  audio: AudioController,
  isInputBlocked: () => boolean = () => false,
  isFpsModeEnabled: () => boolean = () => false
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

    const fpsModeEnabled = isFpsModeEnabled()
    if (fpsModeEnabled) {
      if (!keys[event.code]) {
        keys[event.code] = true

        if (matchesBoundControl(event, 'fire')) {
          input.fireHeld = true
          input.firePending = true
        } else if (matchesBoundControl(event, 'melee')) {
          input.meleePending = true
        } else if (matchesBoundControl(event, 'speakEnergy')) {
          input.speakEpPending = true
        } else if (matchesBoundControl(event, 'speakHealth')) {
          input.speakHpPending = true
        } else if (matchesBoundControl(event, 'speakCoordinates')) {
          input.speakCoordsPending = true
        } else if (matchesBoundControl(event, 'speakDestination')) {
          input.speakDestinationPending = true
        } else if (matchesBoundControl(event, 'moveForward')) {
          input.moveForward = true
        } else if (matchesBoundControl(event, 'moveBack')) {
          input.moveBack = true
        } else if (matchesBoundControl(event, 'strafeLeft')) {
          input.strafeLeft = true
        } else if (matchesBoundControl(event, 'strafeRight')) {
          input.strafeRight = true
        }
      }

      event.preventDefault()
      return
    } // end if FPS mode input should bypass mech controls

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

      if (matchesBoundControl(event, 'recenterPitch')) {
        input.pitchResetPending = true
      } // end if recenterPitch

      if (matchesBoundControl(event, 'jump')) {
        input.jumpPending = true
      } // end if jump

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

    if (isFpsModeEnabled()) {
      if (matchesBoundControl(event, 'fire')) {
        input.fireHeld = false
      } else if (matchesBoundControl(event, 'moveForward')) {
        input.moveForward = false
      } else if (matchesBoundControl(event, 'moveBack')) {
        input.moveBack = false
      } else if (matchesBoundControl(event, 'strafeLeft')) {
        input.strafeLeft = false
      } else if (matchesBoundControl(event, 'strafeRight')) {
        input.strafeRight = false
      } // end if FPS mode movement key release
      return
    } // end if FPS mode key release should not affect mech controls

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

    if (matchesBoundControl(event, 'jump')) {
      input.jumpPending = false
    } // end if jump

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

  }) // end keyup listener
} // end function bindInput
