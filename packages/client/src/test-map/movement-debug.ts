import type { OverencumbranceState } from '../systems/weight/mechWeight.js'
import type { MobilityType } from './update.js'

export interface MovementDebugSpeedLimits {
  activeHorizontal: number
  groundForward: number
  groundReverse: number
  groundStrafe: number
  flightHorizontal: number
} // end interface MovementDebugSpeedLimits

export interface MovementDebugSnapshot {
  movementArchetype: MobilityType
  totalWeight: number
  ratedLoad: number
  loadRatio: number
  overencumbranceState: OverencumbranceState
  flightSpeedMultiplier: number
  effectiveSpeedLimits: MovementDebugSpeedLimits
} // end interface MovementDebugSnapshot
