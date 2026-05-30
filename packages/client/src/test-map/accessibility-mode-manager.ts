type GameplayInputToggleHandler = (enabled: boolean) => void

interface AccessibilityMenuRegistration {
  menuElement: HTMLElement
  focusAnchor: HTMLElement
}

interface AccessibilityModeManagerConfig {
  gameRoot: HTMLElement
  onGameplayInputToggle?: GameplayInputToggleHandler
}

const isDisabledElement = (element: HTMLElement): boolean => {
  return (
    (element instanceof HTMLButtonElement && element.disabled)
    || (element instanceof HTMLInputElement && element.disabled)
    || (element instanceof HTMLSelectElement && element.disabled)
    || (element instanceof HTMLTextAreaElement && element.disabled)
    || (element instanceof HTMLOptionElement && element.disabled)
    || (element instanceof HTMLOptGroupElement && element.disabled)
  )
}

const isElementVisible = (element: HTMLElement): boolean => {
  if (!element.isConnected) {
    return false
  }

  if (element.closest('[hidden], [aria-hidden="true"]')) {
    return false
  }

  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false
  }

  return true
}

const focusElement = (element: HTMLElement): boolean => {
  if (!isElementVisible(element) || isDisabledElement(element)) {
    return false
  }

  element.focus({ preventScroll: true })
  return document.activeElement === element
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'details summary',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]'
].join(', ')

const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  return candidates.filter((element) => {
    if (!isElementVisible(element) || isDisabledElement(element)) {
      return false
    }

    const tabIndex = element.getAttribute('tabindex')
    if (tabIndex !== null && Number(tabIndex) < 0) {
      return false
    }

    return true
  })
}

class AccessibilityModeManager {
  private gameRoot: HTMLElement | null = null
  private gameplayInputToggleHandler: GameplayInputToggleHandler | null = null
  private readonly menus = new Map<string, AccessibilityMenuRegistration>()
  private readonly menuStack: string[] = []
  private readonly focusStack: Array<HTMLElement | null> = []
  private readonly handleDocumentKeydownCapture = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') {
      return
    }

    const activeMenu = this.getActiveMenuRegistration()
    if (!activeMenu) {
      return
    }

    const container = activeMenu.menuElement
    const focusables = getFocusableElements(container)
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null

    if (focusables.length <= 0) {
      event.preventDefault()
      focusElement(activeMenu.focusAnchor)
      return
    }

    const first = focusables[0] ?? null
    const last = focusables[focusables.length - 1] ?? null
    const isFocusInsideMenu = !!activeElement && container.contains(activeElement)

    if (!isFocusInsideMenu) {
      event.preventDefault()
      if (event.shiftKey) {
        if (last) {
          focusElement(last)
        }
      } else if (first) {
        focusElement(first)
      }
      return
    }

    if (!event.shiftKey && activeElement === last) {
      event.preventDefault()
      if (first) {
        focusElement(first)
      }
      return
    }

    if (event.shiftKey && activeElement === first) {
      event.preventDefault()
      if (last) {
        focusElement(last)
      }
    }
  }
  private readonly handleDocumentFocusinCapture = (event: FocusEvent): void => {
    const activeMenu = this.getActiveMenuRegistration()
    if (!activeMenu) {
      return
    }

    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }

    if (activeMenu.menuElement.contains(target)) {
      return
    }

    const focusables = getFocusableElements(activeMenu.menuElement)
    if (focusables.length > 0) {
      focusElement(focusables[0]!)
      return
    }

    focusElement(activeMenu.focusAnchor)
  }

  constructor() {
    document.addEventListener('keydown', this.handleDocumentKeydownCapture, true)
    document.addEventListener('focusin', this.handleDocumentFocusinCapture, true)
  }

  configure(config: AccessibilityModeManagerConfig): void {
    this.gameRoot = config.gameRoot
    this.gameplayInputToggleHandler = config.onGameplayInputToggle ?? null
  }

  registerMenu(menuElement: HTMLElement, focusAnchor: HTMLElement): string {
    if (!menuElement.id) {
      throw new Error('AccessibilityModeManager.registerMenu requires menuElement.id.')
    }

    this.menus.set(menuElement.id, { menuElement, focusAnchor })
    menuElement.setAttribute('data-menu-active', 'false')
    return menuElement.id
  }

  pushFocus(): void {
    // The focus stack preserves the launch point for each layered menu.
    // Nested screens can close in LIFO order and restore the prior context.
    const activeElement = document.activeElement
    this.focusStack.push(activeElement instanceof HTMLElement ? activeElement : null)
  }

  popFocus(): void {
    while (this.focusStack.length > 0) {
      const candidate = this.focusStack.pop() ?? null
      if (candidate && focusElement(candidate)) {
        return
      }
    }

    const activeMenuAnchor = this.getActiveMenuAnchor()
    if (activeMenuAnchor && focusElement(activeMenuAnchor)) {
      return
    }

    this.focusGameRoot()
  }

  openMenu(menuId: string): boolean {
    const menu = this.menus.get(menuId)
    if (!menu) {
      return false
    }

    if (this.menuStack[this.menuStack.length - 1] !== menuId) {
      this.pushFocus()
      this.removeMenuFromStack(menuId)
      this.menuStack.push(menuId)
    }

    this.syncMenuAccessibilityState()
    this.enterUiMode(menu.focusAnchor)
    return true
  }

  closeMenu(menuId: string): boolean {
    const menu = this.menus.get(menuId)
    if (!menu) {
      return false
    }

    const wasOpen = this.removeMenuFromStack(menuId)
    this.syncMenuAccessibilityState()

    if (wasOpen) {
      this.popFocus()
    }

    const activeMenuAnchor = this.getActiveMenuAnchor()
    if (activeMenuAnchor) {
      this.enterUiMode(activeMenuAnchor)
    } else {
      this.enterGameMode()
    }

    return wasOpen
  }

  closeTopMenu(): string | null {
    const topMenuId = this.menuStack[this.menuStack.length - 1] ?? null
    if (!topMenuId) {
      return null
    }

    this.closeMenu(topMenuId)
    return topMenuId
  }

  enterGameMode(): void {
    if (!this.gameRoot) {
      return
    }

    // role="application" is only enabled during active piloting so assistive
    // tech routes keystrokes to gameplay controls rather than browse commands.
    this.gameRoot.removeAttribute('inert')
    this.gameRoot.setAttribute('role', 'application')
    this.setGameplayInputEnabled(true)
    this.syncMenuAccessibilityState()

    this.focusGameRoot()
  }

  enterUiMode(focusTarget?: HTMLElement | null): void {
    if (!this.gameRoot) {
      return
    }

    // Menus are regular layered application screens, not modal dialogs.
    // We mark gameplay inert so browse-mode navigation can move through HTML UI.
    this.setGameplayInputEnabled(false)
    this.gameRoot.removeAttribute('role')
    this.gameRoot.setAttribute('inert', '')

    const preferredTarget = focusTarget && isElementVisible(focusTarget) && !isDisabledElement(focusTarget)
      ? focusTarget
      : this.getActiveMenuAnchor()

    if (preferredTarget && focusElement(preferredTarget)) {
      return
    }

    this.focusGameRoot()
  }

  getOpenMenuIds(): readonly string[] {
    return [...this.menuStack]
  }

  private setGameplayInputEnabled(enabled: boolean): void {
    this.gameplayInputToggleHandler?.(enabled)
  }

  private focusGameRoot(): void {
    if (!this.gameRoot) {
      return
    }

    if (this.gameRoot.tabIndex < 0) {
      this.gameRoot.tabIndex = 0
    }

    focusElement(this.gameRoot)
  }

  private removeMenuFromStack(menuId: string): boolean {
    const index = this.menuStack.lastIndexOf(menuId)
    if (index < 0) {
      return false
    }

    this.menuStack.splice(index, 1)
    return true
  }

  private getActiveMenuAnchor(): HTMLElement | null {
    const activeMenu = this.getActiveMenuRegistration()
    if (!activeMenu) {
      return null
    }

    return activeMenu.focusAnchor
  }

  private getActiveMenuRegistration(): AccessibilityMenuRegistration | null {
    const topMenuId = this.menuStack[this.menuStack.length - 1]
    if (!topMenuId) {
      return null
    }

    return this.menus.get(topMenuId) ?? null
  }

  private syncMenuAccessibilityState(): void {
    const activeMenuId = this.menuStack[this.menuStack.length - 1] ?? null
    for (const [menuId] of this.menus) {
      this.setMenuActive(menuId, menuId === activeMenuId)
    }
  }

  private setMenuActive(menuId: string, active: boolean): void {
    const menu = this.menus.get(menuId)
    if (!menu) {
      return
    }

    menu.menuElement.setAttribute('data-menu-active', active ? 'true' : 'false')
    menu.menuElement.setAttribute('aria-hidden', active ? 'false' : 'true')
    if (active) {
      menu.menuElement.removeAttribute('inert')
    } else {
      menu.menuElement.setAttribute('inert', '')
    }
  }
}

export const accessibilityModeManager = new AccessibilityModeManager()
