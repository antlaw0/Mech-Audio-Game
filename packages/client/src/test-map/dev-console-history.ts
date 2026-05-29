const HISTORY_STORAGE_KEY = 'mech.devConsole.history.v1'
const MAX_HISTORY_ENTRIES = 20

const getWindowStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

const normalizeHistory = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(-MAX_HISTORY_ENTRIES)
}

export const loadDevConsoleHistory = (): string[] => {
  const storage = getWindowStorage()
  if (!storage) {
    return []
  }

  const rawValue = storage.getItem(HISTORY_STORAGE_KEY)
  if (!rawValue) {
    return []
  }

  try {
    return normalizeHistory(JSON.parse(rawValue) as unknown)
  } catch {
    return []
  }
}

export const saveDevConsoleHistory = (history: readonly string[]): void => {
  const storage = getWindowStorage()
  if (!storage) {
    return
  }

  storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(normalizeHistory(history)))
}
