import type { AudioController, InputState } from './types.js'
import { isEditableEventTarget, isTypingContextActive } from './keyboard-focus.js'

function shouldPreventDefault(code: string): boolean {
  return ['Space'].includes(code)
} // end function shouldPreventDefault

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

    if (event.code === 'F2' && !event.repeat) {
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

      if (event.code === 'KeyW') {
        input.moveForward = true
      } // end if KeyW

      if (event.code === 'KeyS') {
        input.moveBack = true
      } // end if KeyS

      if (event.code === 'KeyA') {
        input.strafeLeft = true
      } // end if KeyA

      if (event.code === 'KeyD') {
        input.strafeRight = true
      } // end if KeyD

      if (event.code === 'KeyJ') {
        input.turnLeft = true
      } // end if KeyJ

      if (event.code === 'KeyL') {
        input.turnRight = true
      } // end if KeyL

      if (event.code === 'KeyI') {
        input.lookUp = true
        if (input.lookDown) {
          input.lookUp = false
          input.lookDown = false
          input.pitchResetPending = true
        } // end if pitch reset key combo detected
      } // end if KeyI

      if (event.code === 'KeyK') {
        input.lookDown = true
        if (input.lookUp) {
          input.lookUp = false
          input.lookDown = false
          input.pitchResetPending = true
        } // end if pitch reset key combo detected
      } // end if KeyK

      if (event.code === 'Space') {
        input.fireHeld = true
        input.firePending = true
      } // end if Space

      if (event.code === 'Tab') {
        event.preventDefault()
        input.reloadPending = true
      } // end if Tab

      if (event.code === 'KeyR') {
        input.meleePending = true
      } // end if KeyR

      if (event.code === 'KeyF') {
        input.flightTogglePending = true
      } // end if KeyF

      if (event.code === 'KeyE') {
        input.sonarPingPending = true
      } // end if KeyE



      if (event.code === 'Digit1') {
        input.selectedWeaponSlot = 1
      } // end if Digit1

      if (event.code === 'Digit2') {
        input.selectedWeaponSlot = 2
      } // end if Digit2

      if (event.code === 'Digit3') {
        input.selectedWeaponSlot = 3
      } // end if Digit3

      if (event.code === 'Digit4') {
        input.selectedWeaponSlot = 4
      } // end if Digit4

      if (event.code === 'Digit5') {
        input.selectedWeaponSlot = 5
      } // end if Digit5

      if (event.code === 'Digit6') {
        input.selectedWeaponSlot = 6
      } // end if Digit6

      if (event.code === 'Digit7') {
        input.selectedWeaponSlot = 7
      } // end if Digit7

      if (event.code === 'Numpad1') {
        input.spawnTankPending = true
      } // end if Numpad1

      if (event.code === 'Numpad2') {
        input.spawnStrikerPending = true
      } // end if Numpad2

      if (event.code === 'Numpad3') {
        input.spawnBrutePending = true
      } // end if Numpad3

      if (event.code === 'Numpad4') {
        input.spawnHelicopterPending = true
      } // end if Numpad4

      if (event.code === 'Numpad5') {
        input.spawnBruiserPending = true
      } // end if Numpad5

      if (event.code === 'NumpadDecimal') {
        input.spawnTestDummyPending = true
      } // end if NumpadDecimal

      if (event.code === 'NumpadDivide') {
        input.refillEpPending = true
      } // end if NumpadDivide

      if (event.code === 'NumpadMultiply') {
        input.refillHpPending = true
      } // end if NumpadMultiply

      if (event.code === 'KeyG') {
        input.speakEpPending = true
      } // end if KeyG

      if (event.code === 'KeyH') {
        input.speakHpPending = true
      } // end if KeyH

      if (event.code === 'KeyT') {
        input.speakCoordsPending = true
      } // end if KeyT

      if (event.code === 'KeyN') {
        input.speakDestinationPending = true
      } // end if KeyN

      if (event.code === 'KeyQ') {
        input.boostTogglePending = true
      } // end if KeyQ toggle boost mode

      if (event.code === 'KeyZ') {
        const enabled = audio.toggleCategory('proximity')
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(`proximity ${enabled ? 'on' : 'off'}`))
      } // end if KeyZ toggle proximity category

      if (event.code === 'KeyX') {
        const enabled = audio.toggleCategory('objects')
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(`objects ${enabled ? 'on' : 'off'}`))
      } // end if KeyX toggle objects category

      if (event.code === 'KeyC') {
        const enabled = audio.toggleCategory('enemies')
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(`enemies ${enabled ? 'on' : 'off'}`))
      } // end if KeyC toggle enemies category

      if (event.code === 'KeyV') {
        const enabled = audio.toggleCategory('navigation')
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(`navigation ${enabled ? 'on' : 'off'}`))
      } // end if KeyV toggle navigation category

      if ((event.code === 'KeyJ' || event.code === 'KeyL') && audio.isAudioStarted()) {
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

    if (event.code === 'KeyW') {
      input.moveForward = false
    } // end if KeyW

    if (event.code === 'KeyS') {
      input.moveBack = false
    } // end if KeyS

    if (event.code === 'KeyA') {
      input.strafeLeft = false
    } // end if KeyA

    if (event.code === 'KeyD') {
      input.strafeRight = false
    } // end if KeyD

    if (event.code === 'KeyJ') {
      input.turnLeft = false
    } // end if KeyJ

    if (event.code === 'KeyL') {
      input.turnRight = false
    } // end if KeyL

    if (event.code === 'KeyI') {
      input.lookUp = false
    } // end if KeyI

    if (event.code === 'KeyK') {
      input.lookDown = false
    } // end if KeyK

    if (event.code === 'Space') {
      input.fireHeld = false
    } // end if Space

    if (event.code === 'KeyR') {
      input.meleePending = false
    } // end if KeyR

    if (event.code === 'KeyF') {
      input.flightTogglePending = false
    } // end if KeyF

    if (event.code === 'KeyE') {
      input.sonarPingPending = false
    } // end if KeyE



    if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3' || event.code === 'Digit4' || event.code === 'Digit5' || event.code === 'Digit6' || event.code === 'Digit7') {
      input.selectedWeaponSlot = null
    } // end if Digit key released

    if (event.code === 'Numpad1') {
      input.spawnTankPending = false
    } // end if Numpad1

    if (event.code === 'Numpad2') {
      input.spawnStrikerPending = false
    } // end if Numpad2

    if (event.code === 'Numpad3') {
      input.spawnBrutePending = false
    } // end if Numpad3

    if (event.code === 'Numpad4') {
      input.spawnHelicopterPending = false
    } // end if Numpad4

    if (event.code === 'Numpad5') {
      input.spawnBruiserPending = false
    } // end if Numpad5

    if (event.code === 'NumpadDecimal') {
      input.spawnTestDummyPending = false
    } // end if NumpadDecimal

    if (event.code === 'NumpadDivide') {
      input.refillEpPending = false
    } // end if NumpadDivide

    if (event.code === 'NumpadMultiply') {
      input.refillHpPending = false
    } // end if NumpadMultiply

    if (event.code === 'KeyG') {
      input.speakEpPending = false
    } // end if KeyG

    if (event.code === 'KeyH') {
      input.speakHpPending = false
    } // end if KeyH

    if (event.code === 'KeyT') {
      input.speakCoordsPending = false
    } // end if KeyT

    if (event.code === 'KeyN') {
      input.speakDestinationPending = false
    } // end if KeyN

    if (
      (event.code === 'KeyJ' || event.code === 'KeyL' || event.code === 'KeyI' || event.code === 'KeyK') &&
      !input.turnLeft &&
      !input.turnRight &&
      !input.lookUp &&
      !input.lookDown
    ) {
      audio.stopServo()
    } // end if turning keys all released
  }) // end keyup listener
} // end function bindInput
