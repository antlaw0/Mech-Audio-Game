const isEditableElement = (element: Element | null): boolean => {
  if (!(element instanceof HTMLElement)) {
    return false
  }

  if (element.isContentEditable) {
    return true
  }

  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
}

export const isEditableEventTarget = (event: Event): boolean => {
  const composedPath = typeof event.composedPath === 'function' ? event.composedPath() : []
  for (const entry of composedPath) {
    if (entry instanceof Element && isEditableElement(entry)) {
      return true
    }
  }

  if (event.target instanceof Element && isEditableElement(event.target)) {
    return true
  }

  return false
}

export const isTypingContextActive = (event: Event): boolean => {
  return isEditableEventTarget(event) || isEditableElement(document.activeElement)
}