export type SpriteType = 'tree' | 'rock'

export interface Vec3 {
  x: number
  y: number
  z: number
} // end interface Vec3

export interface SpriteObject {
  id: string
  x: number
  y: number
  z: number
  type: SpriteType
  radius: number
} // end interface SpriteObject

export interface PlayerState {
  id: string
  x: number
  y: number
  z: number
  angle: number
  pitch: number
} // end interface PlayerState

export interface WorldState {
  tick: number
  mapWidth: number
  mapHeight: number
  mapData: Uint8Array
  sprites: SpriteObject[]
  players: Record<string, PlayerState>
} // end interface WorldState

export interface InputState {
  moveForward: boolean
  moveBack: boolean
  strafeLeft: boolean
  strafeRight: boolean
  turnLeft: boolean
  turnRight: boolean
  lookUp: boolean
  lookDown: boolean
} // end interface InputState
