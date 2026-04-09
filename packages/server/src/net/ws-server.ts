import {
  PLAYER_HEIGHT,
  type InputState,
  type PlayerState,
  type ServerToClientMessage
} from '@mech-audio/shared'
import { WebSocketServer } from 'ws'
import { SERVER_PORT, TICK_INTERVAL_MS } from '../config.js'
import { createWorldState } from '../state/create-world-state.js'
import { tickWorld } from '../simulation/tick-world.js'
import { createClientSession, type ClientSession } from './client-session.js'
import { encodeServerMessage, parseClientMessage, serializeWorld } from './protocol.js'

function send(session: ClientSession, message: ServerToClientMessage): void {
  session.socket.send(encodeServerMessage(message))
} // end function send

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

export function startWebSocketServer(): void {
  const world = createWorldState()
  const sessions = new Map<string, ClientSession>()
  const inputsByPlayerId = new Map<string, InputState>()

  const server = new WebSocketServer({ port: SERVER_PORT })

  server.on('connection', (socket) => {
    let currentSession: ClientSession | null = null

    socket.on('message', (buffer) => {
      const message = parseClientMessage(buffer.toString())
      if (!message) {
        return
      } // end if invalid message

      if (message.type === 'hello') {
        const clientId = message.clientId
        const session = createClientSession(clientId, socket)
        sessions.set(clientId, session)
        world.players[clientId] = createPlayer(clientId)
        currentSession = session

        send(session, {
          type: 'welcome',
          clientId,
          player: world.players[clientId]
        })

        return
      } // end if hello

      if (message.type === 'input') {
        const session = sessions.get(message.clientId)
        if (!session) {
          return
        } // end if unknown session

        session.lastInput = message.input
        inputsByPlayerId.set(message.clientId, message.input)
      } // end if input
    }) // end socket.on message

    socket.on('close', () => {
      if (!currentSession) {
        return
      } // end if no session

      sessions.delete(currentSession.id)
      inputsByPlayerId.delete(currentSession.id)
      delete world.players[currentSession.id]
    }) // end socket.on close
  }) // end server.on connection

  setInterval(() => {
    tickWorld(world, inputsByPlayerId, TICK_INTERVAL_MS / 1000)
    const snapshotMessage: ServerToClientMessage = {
      type: 'snapshot',
      world: serializeWorld(world)
    } // end object snapshotMessage

    for (const session of sessions.values()) {
      send(session, snapshotMessage)
    } // end for each session
  }, TICK_INTERVAL_MS)

  console.log(`[server] websocket listening on ws://localhost:${SERVER_PORT}`)
} // end function startWebSocketServer
