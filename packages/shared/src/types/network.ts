import type { InputState, PlayerState, WorldState } from './world.js'

export type ClientToServerMessage =
  | { type: 'hello'; clientId: string }
  | { type: 'input'; clientId: string; input: InputState }

export type ServerToClientMessage =
  | { type: 'welcome'; clientId: string; player: PlayerState }
  | { type: 'snapshot'; world: SerializedWorldState }

export interface SerializedWorldState {
  tick: number
  mapWidth: number
  mapHeight: number
  mapData: number[]
  sprites: WorldState['sprites']
  players: Record<string, PlayerState>
} // end interface SerializedWorldState
