export type HeatState = 'NORMAL' | 'HOT' | 'CRITICAL' | 'DANGER' | 'OVERHEAT'

export interface EnergyRegenerationInput {
  basePerSecond: number
  weightFactor: number
  heatMultiplier: number
  runtimeMultiplier: number
} // end interface EnergyRegenerationInput

export const resolveHeatState = (
  heatValue: number,
  maxHeatValue: number,
  previousState: HeatState
): HeatState => {
  const ratio = heatValue / Math.max(1, maxHeatValue)
  if (ratio >= 1) {
    return 'OVERHEAT'
  } // end if overheat threshold reached

  if (previousState === 'OVERHEAT' && ratio > 0.25) {
    return 'OVERHEAT'
  } // end if overheat recovery pending

  if (ratio >= 0.85) {
    return 'DANGER'
  } // end if danger threshold reached
  if (ratio >= 0.65) {
    return 'CRITICAL'
  } // end if critical threshold reached
  if (ratio >= 0.4) {
    return 'HOT'
  } // end if hot threshold reached
  return 'NORMAL'
} // end function resolveHeatState

export const getEnergyHeatMultiplier = (heatState: HeatState): number => {
  if (heatState === 'HOT') {
    return 0.8
  } // end if hot state
  if (heatState === 'CRITICAL') {
    return 0.55
  } // end if critical state
  if (heatState === 'DANGER') {
    return 0.25
  } // end if danger state
  if (heatState === 'OVERHEAT') {
    return 0
  } // end if overheat state
  return 1
} // end function getEnergyHeatMultiplier

export const calculateEnergyRegeneration = (input: EnergyRegenerationInput): number => {
  return Math.max(0, input.basePerSecond)
    * Math.max(0, input.weightFactor)
    * Math.max(0, input.heatMultiplier)
    * Math.max(0, input.runtimeMultiplier)
} // end function calculateEnergyRegeneration
