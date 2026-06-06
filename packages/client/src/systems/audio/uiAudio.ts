import type { AudioController } from '../../test-map/types.js'

export enum UiSound {
  Focus = 'Focus',
  Activate = 'Activate',
  Back = 'Back',
  Positive = 'Positive',
  Negative = 'Negative',
  Notification = 'Notification',
  PopupOpen = 'PopupOpen',
  PopupClose = 'PopupClose',
  EquipPart = 'EquipPart'
}

export type UiAudioService = {
  play: (sound: UiSound) => void
  installGlobalFocusAndActivationAudio: (focusCooldownMs?: number) => void
  uninstallGlobalFocusAndActivationAudio: () => void
}

const UI_SOUND_PATHS: Readonly<Record<UiSound, string>> = {
  [UiSound.Focus]: 'assets/sounds/ui/focus.ogg',
  [UiSound.Activate]: 'assets/sounds/ui/switch.ogg',
  [UiSound.Back]: 'assets/sounds/ui/back.ogg',
  [UiSound.Positive]: 'assets/sounds/ui/positive.ogg',
  [UiSound.Negative]: 'assets/sounds/ui/negative.ogg',
  [UiSound.Notification]: 'assets/sounds/ui/notification.ogg',
  [UiSound.PopupOpen]: 'assets/sounds/ui/popupOpen.ogg',
  [UiSound.PopupClose]: 'assets/sounds/ui/popupClose.ogg',
  [UiSound.EquipPart]: 'assets/sounds/ui/equipPart.ogg'
}

const isDisabledUiElement = (element: HTMLElement): boolean => {
  return (
    (element instanceof HTMLButtonElement && element.disabled)
    || (element instanceof HTMLInputElement && element.disabled)
    || (element instanceof HTMLSelectElement && element.disabled)
    || (element instanceof HTMLTextAreaElement && element.disabled)
  )
}

const isValidFocusTarget = (element: HTMLElement): boolean => {
  if (!element.isConnected || element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') {
    return false
  }
  if (isDisabledUiElement(element)) {
    return false
  }
  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false
  }
  if (element.id === 'gameCanvas') {
    return false
  }
  return true
}

const resolveInteractiveTarget = (eventTarget: EventTarget | null): HTMLElement | null => {
  if (!(eventTarget instanceof HTMLElement)) {
    return null
  }
  const candidate = eventTarget.closest(
    'button, [role="button"], a[href], input[type="button"], input[type="submit"], input[type="reset"], select, [data-ui-activate]'
  )
  if (!(candidate instanceof HTMLElement) || !isValidFocusTarget(candidate)) {
    return null
  }
  return candidate
}

export const createUiAudioService = (audio: AudioController): UiAudioService => {
  let focusCooldownMs = 50
  let lastFocusAtMs = -Infinity
  let lastFocusedElement: HTMLElement | null = null
  let focusListenerInstalled = false

  const play = (sound: UiSound): void => {
    const path = UI_SOUND_PATHS[sound]
    if (!path) {
      return
    }

    if (!audio.isAudioStarted()) {
      void audio.ensureAudio().then(() => {
        audio.playUiCue(path)
      })
      return
    }

    audio.playUiCue(path)
  }

  const onFocusIn = (event: FocusEvent): void => {
    if (!(event.target instanceof HTMLElement)) {
      return
    }
    if (!isValidFocusTarget(event.target)) {
      return
    }
    if (event.target === lastFocusedElement) {
      return
    }

    const now = performance.now()
    if ((now - lastFocusAtMs) < focusCooldownMs) {
      lastFocusedElement = event.target
      return
    }

    lastFocusAtMs = now
    lastFocusedElement = event.target
    play(UiSound.Focus)
  }

  const onClick = (event: MouseEvent): void => {
    const target = resolveInteractiveTarget(event.target)
    if (!target) {
      return
    }
    play(UiSound.Activate)
  }

  const installGlobalFocusAndActivationAudio = (focusCooldownOverrideMs = 50): void => {
    focusCooldownMs = Math.max(40, Math.min(60, focusCooldownOverrideMs))
    if (focusListenerInstalled) {
      return
    }
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('click', onClick, true)
    focusListenerInstalled = true
  }

  const uninstallGlobalFocusAndActivationAudio = (): void => {
    if (!focusListenerInstalled) {
      return
    }
    document.removeEventListener('focusin', onFocusIn, true)
    document.removeEventListener('click', onClick, true)
    focusListenerInstalled = false
  }

  return {
    play,
    installGlobalFocusAndActivationAudio,
    uninstallGlobalFocusAndActivationAudio
  }
}
