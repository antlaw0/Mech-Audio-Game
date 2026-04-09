import {
  parseClientToServerMessage,
  type ClientToServerMessage,
  type SerializedWorldState,
  type ServerToClientMessage,
  type WorldState
} from '@mech-audio/shared'

export function parseClientMessage(raw: string): ClientToServerMessage | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    return parseClientToServerMessage(parsed)
  } catch {
    return null
  } // end try parse
} // end function parseClientMessage

export function serializeWorld(world: WorldState): SerializedWorldState {
  return {
    tick: world.tick,
    mapWidth: world.mapWidth,
    mapHeight: world.mapHeight,
    mapData: Array.from(world.mapData),
    sprites: world.sprites,
    players: world.players
  } // end object serialized world
} // end function serializeWorld

export function encodeServerMessage(message: ServerToClientMessage): string {
  return JSON.stringify(message)
} // end function encodeServerMessage
