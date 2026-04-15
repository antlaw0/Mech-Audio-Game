import { DEFAULT_FLIGHT_HEIGHT } from './constants.js'

export interface RuntimeTuningConfig {
  flightHeight: number
} // end interface RuntimeTuningConfig

export const runtimeTuning: RuntimeTuningConfig = {
  flightHeight: DEFAULT_FLIGHT_HEIGHT
} // end object runtimeTuning

export function getSharedFlightHeight(): number {
  return Math.max(0, runtimeTuning.flightHeight)
} // end function getSharedFlightHeight

export function setSharedFlightHeight(value: number): number {
  runtimeTuning.flightHeight = Math.max(0, value)
  return runtimeTuning.flightHeight
} // end function setSharedFlightHeight