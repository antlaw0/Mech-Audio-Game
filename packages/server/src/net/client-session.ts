import type { InputState } from '@mech-audio/shared'
import type { WebSocket } from 'ws'

const EMPTY_INPUT: InputState = {
  moveForward: false,
  moveBack: false,
  strafeLeft: false,
  strafeRight: false,
  turnLeft: false,
  turnRight: false,
  lookUp: false,
  lookDown: false
} // end object EMPTY_INPUT

export interface ClientSession {
  id: string
  socket: WebSocket
  lastInput: InputState
} // end interface ClientSession

export function createClientSession(id: string, socket: WebSocket): ClientSession {
  return {
    id,
    socket,
    lastInput: { ...EMPTY_INPUT }
  } // end object client session
} // end function createClientSession
