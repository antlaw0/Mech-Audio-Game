import type { InputState, Player } from './types.js'

export function createPlayer(): Player {
  return {
    x: 24.5,
    y: 24.5,
    angle: 0,
    pitch: 0,
    z: 0,
    flightState: 'grounded',
    isFlying: false
  } // end object player
} // end function createPlayer

export function createInputState(): InputState {
  return {
    moveForward: false,
    moveBack: false,
    strafeLeft: false,
    strafeRight: false,
    turnLeft: false,
    turnRight: false,
    lookUp: false,
    lookDown: false,
    pitchResetPending: false,
    fireHeld: false,
    firePending: false,
    flightTogglePending: false,
    sonarPingPending: false,
    snapNorthPending: false,
    snapEastPending: false,
    snapSouthPending: false,
    snapWestPending: false,
    cycleWeaponPending: false,
    selectedWeaponSlot: null,
    spawnTankPending: false,
    spawnStrikerPending: false,
    spawnBrutePending: false,
    spawnHelicopterPending: false
  } // end object input state
} // end function createInputState
