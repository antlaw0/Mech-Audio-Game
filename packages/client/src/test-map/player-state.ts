import type { InputState, Player } from './types.js'

export function createPlayer(): Player {
  return {
    x: 200,
    y: 500,
    angle: 0,
    pitch: 0,
    hp: 1000,
    maxHp: 1000,
    ep: 1000,
    maxEp: 1000,
    z: 0,
    flightState: 'grounded',
    isFlying: false,
    isBoosting: false
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
    snapLeftPending: false,
    snapRightPending: false,
    cycleWeaponPending: false,
    selectedWeaponSlot: null,
    spawnTankPending: false,
    spawnStrikerPending: false,
    spawnBrutePending: false,
    spawnHelicopterPending: false,
    refillEpPending: false,
    refillHpPending: false,
    speakHpPending: false,
    speakEpPending: false,
    speakCoordsPending: false,
    speakDestinationPending: false,
    boostTogglePending: false
  } // end object input state
} // end function createInputState
