import http from 'node:http'
import { Server } from 'colyseus'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { MechRoom } from './mech-room.js'

export const COLYSEUS_PORT = 2567

export async function startColyseusServer(port = COLYSEUS_PORT): Promise<void> {
  const gameServer = new Server({
    transport: new WebSocketTransport({
      server: http.createServer()
    })
  })

  gameServer.define('mech_room', MechRoom)
  await gameServer.listen(port)
  console.log(`[server] colyseus listening on ws://localhost:${port}`)
} // end function startColyseusServer
