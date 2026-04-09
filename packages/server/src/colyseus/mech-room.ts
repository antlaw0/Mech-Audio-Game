import {
  InputStateSchema,
  PLAYER_HEIGHT,
  type InputState,
  type PlayerState,
  type ServerToClientMessage
} from '@mech-audio/shared'
import { Client, Room } from 'colyseus'
import { TICK_INTERVAL_MS } from '../config.js'
import { createWorldState } from '../state/create-world-state.js'
import { tickWorld } from '../simulation/tick-world.js'
import { serializeWorld } from '../net/protocol.js'

function createPlayer(clientId: string): PlayerState {
  return {
    id: clientId,
    x: 16.5,
    y: 16.5,
    z: PLAYER_HEIGHT,
    angle: 0,
    pitch: 0
  } // end object player
} // end function createPlayer

export class MechRoom extends Room {
  private readonly inputsByPlayerId = new Map<string, InputState>()
  private readonly world = createWorldState()

  onCreate(): void {
    this.setSimulationInterval(() => {
      tickWorld(this.world, this.inputsByPlayerId, TICK_INTERVAL_MS / 1000)
      const snapshotMessage: ServerToClientMessage = {
        type: 'snapshot',
        world: serializeWorld(this.world)
      } // end object snapshotMessage
      this.broadcast('message', snapshotMessage)
    }, TICK_INTERVAL_MS)

    this.onMessage('input', (client: Client, rawInput: InputState) => {
      const parsed = InputStateSchema.safeParse(rawInput)
      if (!parsed.success) {
        return
      } // end if invalid input payload
      this.inputsByPlayerId.set(client.sessionId, parsed.data)
    })
  } // end function onCreate

  onJoin(client: Client): void {
    const player = createPlayer(client.sessionId)
    this.world.players[client.sessionId] = player
    const welcomeMessage: ServerToClientMessage = {
      type: 'welcome',
      clientId: client.sessionId,
      player
    } // end object welcomeMessage
    client.send('message', welcomeMessage)
  } // end function onJoin

  onLeave(client: Client): void {
    this.inputsByPlayerId.delete(client.sessionId)
    delete this.world.players[client.sessionId]
  } // end function onLeave
}
