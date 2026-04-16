export interface DeveloperConsoleElements {
  overlay: HTMLDivElement
  output: HTMLDivElement
  input: HTMLInputElement
  status: HTMLDivElement
} // end interface DeveloperConsoleElements

export interface DeveloperConsoleOptions {
  elements: DeveloperConsoleElements
  executeCommand: (commandLine: string) => Promise<string | string[] | null | undefined> | string | string[] | null | undefined
  closeConsole: () => Promise<void> | void
  getSuggestions: (commandLine: string) => string[]
} // end interface DeveloperConsoleOptions

export interface DeveloperConsoleController {
  open: () => void
  close: () => void
  isOpen: () => boolean
  focusInput: () => void
  setStatus: (value: string) => void
  print: (message: string | string[], tone?: 'system' | 'error' | 'input') => void
  clearOutput: () => void
} // end interface DeveloperConsoleController

function longestCommonPrefix(values: string[]): string {
  if (values.length === 0) {
    return ''
  } // end if no values

  let prefix = values[0] ?? ''
  for (let index = 1; index < values.length; index += 1) {
    const value = values[index] ?? ''
    let matchLength = 0
    while (matchLength < prefix.length && matchLength < value.length && prefix[matchLength] === value[matchLength]) {
      matchLength += 1
    } // end while prefix chars match
    prefix = prefix.slice(0, matchLength)
    if (prefix.length === 0) {
      break
    } // end if no common prefix remains
  } // end for each value

  return prefix
} // end function longestCommonPrefix

export function createDeveloperConsole(options: DeveloperConsoleOptions): DeveloperConsoleController {
  const { overlay, output, input, status } = options.elements
  const history: string[] = []
  let historyIndex = -1
  let open = false

  const focusInput = (): void => {
    window.requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    })
  } // end function focusInput

  const clearOutput = (): void => {
    output.innerHTML = ''
  } // end function clearOutput

  const print = (message: string | string[], tone: 'system' | 'error' | 'input' = 'system'): void => {
    const lines = Array.isArray(message) ? message : [message]
    for (const line of lines) {
      const row = document.createElement('div')
      row.className = `dev-console-line ${tone}`
      row.textContent = line
      output.appendChild(row)
    } // end for each output line

    while (output.childElementCount > 240) {
      output.firstElementChild?.remove()
    } // end while output exceeds retention limit

    output.scrollTop = output.scrollHeight
  } // end function print

  const setStatus = (value: string): void => {
    status.textContent = value
  } // end function setStatus

  const openConsole = (): void => {
    open = true
    overlay.style.display = 'flex'
    overlay.setAttribute('aria-hidden', 'false')
    focusInput()
  } // end function openConsole

  const closeConsole = (): void => {
    open = false
    overlay.style.display = 'none'
    overlay.setAttribute('aria-hidden', 'true')
    input.blur()
  } // end function closeConsole

  input.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      const commandLine = input.value.trim()
      if (commandLine.length === 0) {
        return
      } // end if command line is empty

      history.push(commandLine)
      historyIndex = history.length
      print(`> ${commandLine}`, 'input')
      input.value = ''

      if (commandLine.toLowerCase() === 'clear') {
        clearOutput()
        print('Console cleared.', 'system')
        return
      } // end if clearing output

      try {
        const result = await options.executeCommand(commandLine)
        if (Array.isArray(result) && result.length > 0) {
          print(result, 'system')
        } else if (typeof result === 'string' && result.length > 0) {
          print(result, 'system')
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Command failed.'
        print(message, 'error')
      } // end try/catch command execution
      return
    } // end if Enter pressed

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (history.length === 0) {
        return
      } // end if no history exists
      historyIndex = Math.max(0, historyIndex - 1)
      input.value = history[historyIndex] ?? ''
      focusInput()
      return
    } // end if navigating history backward

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (history.length === 0) {
        return
      } // end if no history exists
      historyIndex = Math.min(history.length, historyIndex + 1)
      input.value = historyIndex >= history.length ? '' : (history[historyIndex] ?? '')
      focusInput()
      return
    } // end if navigating history forward

    if (event.key === 'Tab') {
      event.preventDefault()
      const suggestions = options.getSuggestions(input.value)
      if (suggestions.length === 0) {
        return
      } // end if no suggestions available
      if (suggestions.length === 1) {
        input.value = suggestions[0] ?? input.value
        focusInput()
        return
      } // end if only one suggestion exists

      const commonPrefix = longestCommonPrefix(suggestions)
      if (commonPrefix.length > input.value.length) {
        input.value = commonPrefix
        focusInput()
      } else {
        print(suggestions.map((suggestion) => `  ${suggestion}`), 'system')
      } // end if autocomplete can extend current prefix
      return
    } // end if Tab pressed

    if (event.key === 'Escape' || event.key === '`') {
      event.preventDefault()
      await options.closeConsole()
    } // end if closing console from input
  })

  overlay.addEventListener('pointerdown', (event) => {
    const target = event.target
    if (target instanceof HTMLElement && target !== input) {
      focusInput()
    } // end if overlay click should refocus input
  })

  return {
    open: openConsole,
    close: closeConsole,
    isOpen: () => open,
    focusInput,
    setStatus,
    print,
    clearOutput
  } // end object developer console controller
} // end function createDeveloperConsole