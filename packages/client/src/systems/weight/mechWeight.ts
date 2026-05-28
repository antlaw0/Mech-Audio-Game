export type OverencumbranceState = 'normal' | 'heavy' | 'severe' | 'extreme'

export interface OverencumbranceThresholds {
  heavyMinRatio: number
  severeMinRatio: number
  extremeMinRatio: number
} // end interface OverencumbranceThresholds

export interface OverencumbranceResult {
  loadRatio: number
  state: OverencumbranceState
} // end interface OverencumbranceResult

export const DEFAULT_OVERENCUMBRANCE_THRESHOLDS: OverencumbranceThresholds = {
  heavyMinRatio: 1,
  severeMinRatio: 1.5,
  extremeMinRatio: 2
}

export const getTotalMechWeight = (installedPartWeight: number, cargoWeight: number): number => {
  return Math.max(0, installedPartWeight) + Math.max(0, cargoWeight)
} // end function getTotalMechWeight

export const getOverencumbranceState = (
  totalWeight: number,
  ratedLoad: number,
  thresholds: OverencumbranceThresholds = DEFAULT_OVERENCUMBRANCE_THRESHOLDS
): OverencumbranceResult => {
  const safeRatedLoad = Math.max(1, ratedLoad)
  const loadRatio = Math.max(0, totalWeight) / safeRatedLoad

  if (loadRatio >= thresholds.extremeMinRatio) {
    return { loadRatio, state: 'extreme' }
  } // end if extreme

  if (loadRatio >= thresholds.severeMinRatio) {
    return { loadRatio, state: 'severe' }
  } // end if severe

  if (loadRatio >= thresholds.heavyMinRatio) {
    return { loadRatio, state: 'heavy' }
  } // end if heavy

  return { loadRatio, state: 'normal' }
} // end function getOverencumbranceState
