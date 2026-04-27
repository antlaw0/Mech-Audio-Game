import type { AudioController, InputState } from './types.js'

function shouldPreventDefault(code: string): boolean {
  return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)
} // end function shouldPreventDefault

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  } // end if target is not a DOM element

  if (target.isContentEditable) {
    return true
  } // end if contenteditable target

  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
} // end function isEditableTarget

export function bindInput(
  input: InputState,
  audio: AudioController,
  isInputBlocked: () => boolean = () => false
): void {
  const keys: Record<string, boolean> = {}
  const shouldHandleDirectionalSnap = (event: KeyboardEvent): boolean => {
    return event.ctrlKey && (event.code === 'ArrowLeft' || event.code === 'ArrowRight')
  } // end function shouldHandleDirectionalSnap

  const resumeAudioOnInteraction = (): void => {
    void audio.ensureAudio()
  } // end function resumeAudioOnInteraction

  document.addEventListener('pointerdown', resumeAudioOnInteraction)
  document.addEventListener('touchstart', resumeAudioOnInteraction, { passive: true })

  document.addEventListener('keydown', async (event) => {
    if (isEditableTarget(event.target)) {
      return
    } // end if typing in editable field

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

      if (event.code === 'ArrowLeft') {
        input.turnLeft = true
      } // end if ArrowLeft

      if (event.code === 'ArrowRight') {
        input.turnRight = true
      } // end if ArrowRight

      if (event.code === 'ArrowUp') {
        input.lookUp = true
        if (input.lookDown) {
          input.lookUp = false
          input.lookDown = false
          input.pitchResetPending = true
        } // end if pitch reset key combo detected
      } // end if ArrowUp

      if (event.code === 'ArrowDown') {
        input.lookDown = true
        if (input.lookUp) {
          input.lookUp = false
          input.lookDown = false
          input.pitchResetPending = true
        } // end if pitch reset key combo detected
      } // end if ArrowDown

      if (event.code === 'Space') {
        input.fireHeld = true
        input.firePending = true
      } // end if Space

      if (event.code === 'KeyF') {
        input.flightTogglePending = true
      } // end if KeyF

      if (event.code === 'KeyE') {
        input.sonarPingPending = true
      } // end if KeyE

      if (event.code === 'KeyI') {
        input.snapNorthPending = true
      } // end if KeyI

      if (event.code === 'KeyL') {
        input.snapEastPending = true
      } // end if KeyL

      if (event.code === 'KeyK') {
        input.snapSouthPending = true
      } // end if KeyK

      if (event.code === 'KeyJ') {
        input.snapWestPending = true
      } // end if KeyJ

      if (event.code === 'KeyR') {
        input.cycleWeaponPending = true
      } // end if KeyR

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

      if ((event.code === 'ArrowLeft' || event.code === 'ArrowRight') && audio.isAudioStarted()) {
        audio.startServo()
      } // end if turn key and audio started
    } // end if key was not held

    if (shouldPreventDefault(event.code)) {
      event.preventDefault()
    } // end if prevent default
  }) // end keydown listener

  document.addEventListener('keyup', (event) => {
    if (isEditableTarget(event.target)) {
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

    if (event.code === 'ArrowLeft') {
      input.turnLeft = false
    } // end if ArrowLeft

    if (event.code === 'ArrowRight') {
      input.turnRight = false
    } // end if ArrowRight

    if (event.code === 'ArrowUp') {
      input.lookUp = false
    } // end if ArrowUp

    if (event.code === 'ArrowDown') {
      input.lookDown = false
    } // end if ArrowDown

    if (event.code === 'Space') {
      input.fireHeld = false
    } // end if Space

    if (event.code === 'KeyF') {
      input.flightTogglePending = false
    } // end if KeyF

    if (event.code === 'KeyE') {
      input.sonarPingPending = false
    } // end if KeyE

    if (event.code === 'KeyI') {
      input.snapNorthPending = false
    } // end if KeyI

    if (event.code === 'KeyL') {
      input.snapEastPending = false
    } // end if KeyL

    if (event.code === 'KeyK') {
      input.snapSouthPending = false
    } // end if KeyK

    if (event.code === 'KeyJ') {
      input.snapWestPending = false
    } // end if KeyJ

    if (event.code === 'ArrowLeft') {
      input.snapLeftPending = false
    } // end if ArrowLeft directional snap

    if (event.code === 'ArrowRight') {
      input.snapRightPending = false
    } // end if ArrowRight directional snap

    if (event.code === 'KeyR') {
      input.cycleWeaponPending = false
    } // end if KeyR

    if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3' || event.code === 'Digit4') {
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
      (event.code === 'ArrowLeft' || event.code === 'ArrowRight' || event.code === 'ArrowUp' || event.code === 'ArrowDown') &&
      !input.turnLeft &&
      !input.turnRight &&
      !input.lookUp &&
      !input.lookDown
    ) {
      audio.stopServo()
    } // end if turning keys all released
  }) // end keyup listener
} // end function bindInput
