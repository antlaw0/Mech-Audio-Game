import type { AudioController, InputState } from './types.js'

function shouldPreventDefault(code: string): boolean {
  return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)
} // end function shouldPreventDefault

export function bindInput(input: InputState, audio: AudioController): void {
  const keys: Record<string, boolean> = {}

  const resumeAudioOnInteraction = (): void => {
    void audio.ensureAudio()
  } // end function resumeAudioOnInteraction

  document.addEventListener('pointerdown', resumeAudioOnInteraction)
  document.addEventListener('touchstart', resumeAudioOnInteraction, { passive: true })

  document.addEventListener('keydown', async (event) => {
    await audio.ensureAudio()

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
        input.lookDown = true
        if (input.lookUp) {
          input.lookUp = false
          input.lookDown = false
          input.pitchResetPending = true
        } // end if pitch reset key combo detected
      } // end if ArrowUp

      if (event.code === 'ArrowDown') {
        input.lookUp = true
        if (input.lookDown) {
          input.lookUp = false
          input.lookDown = false
          input.pitchResetPending = true
        } // end if pitch reset key combo detected
      } // end if ArrowDown

      if (event.code === 'Space') {
        input.firePending = true
      } // end if Space

      if (event.code === 'KeyE') {
        input.sonarPingPending = true
      } // end if KeyE

      if (event.code === 'KeyQ') {
        audio.setAimAssistEnabled(!audio.isAimAssistEnabled())
      } // end if KeyQ toggle aim assist

      if ((event.code === 'ArrowLeft' || event.code === 'ArrowRight') && audio.isAudioStarted()) {
        audio.startServo()
      } // end if turn key and audio started
    } // end if key was not held

    if (shouldPreventDefault(event.code)) {
      event.preventDefault()
    } // end if prevent default
  }) // end keydown listener

  document.addEventListener('keyup', (event) => {
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
      input.lookDown = false
    } // end if ArrowUp

    if (event.code === 'ArrowDown') {
      input.lookUp = false
    } // end if ArrowDown

    if (event.code === 'KeyE') {
      input.sonarPingPending = false
    } // end if KeyE

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
