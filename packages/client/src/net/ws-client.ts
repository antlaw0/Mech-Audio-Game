import {
  type ServerToClientMessage
} from '../../../shared/dist/types/network.js'
import type { InputState } from '../../../shared/dist/types/world.js'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
} // end function isRecord

function isString(value: unknown): value is string {
  return typeof value === 'string'
} // end function isString

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
} // end function isNumber

function isInputState(value: unknown): value is InputState {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.moveForward === 'boolean'
    && typeof value.moveBack === 'boolean'
    && typeof value.strafeLeft === 'boolean'
    && typeof value.strafeRight === 'boolean'
    && typeof value.turnLeft === 'boolean'
    && typeof value.turnRight === 'boolean'
    && typeof value.lookUp === 'boolean'
    && typeof value.lookDown === 'boolean'
  )
} // end function isInputState

function isPlayerState(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return isString(value.id)
    && isNumber(value.x)
    && isNumber(value.y)
    && isNumber(value.z)
    && isNumber(value.angle)
    && isNumber(value.pitch)
} // end function isPlayerState

function isSerializedWorldState(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  const tick = value.tick
  const mapWidth = value.mapWidth
  const mapHeight = value.mapHeight

  if (typeof tick !== 'number' || !Number.isInteger(tick) || tick < 0) {
    return false
  }

  if (typeof mapWidth !== 'number' || !Number.isInteger(mapWidth) || mapWidth <= 0) {
    return false
  }

  if (typeof mapHeight !== 'number' || !Number.isInteger(mapHeight) || mapHeight <= 0) {
    return false
  }

  if (!Array.isArray(value.mapData) || !value.mapData.every((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 255)) {
    return false
  }

  if (!Array.isArray(value.sprites) || !value.sprites.every(isRecord)) {
    return false
  }

  if (!isRecord(value.players)) {
    return false
  }

  return Object.values(value.players).every(isPlayerState)
} // end function isSerializedWorldState

function parseServerToClientMessage(value: unknown): ServerToClientMessage | null {
  if (!isRecord(value) || !isString(value.type)) {
    return null
  }

  if (value.type === 'welcome') {
    if (!isString(value.clientId) || !isPlayerState(value.player)) {
      return null
    }

    return value as ServerToClientMessage
  }

  if (value.type === 'snapshot') {
    if (!isSerializedWorldState(value.world)) {
      return null
    }

    return value as ServerToClientMessage
  }

  return null
} // end function parseServerToClientMessage

export interface WsClient {
  connect: (clientId: string, onMessage?: (message: ServerToClientMessage) => void) => void
  sendInput: (clientId: string, input: InputState) => void
  close: () => void
} // end interface WsClient

export function createWsClient(url: string): WsClient {
  let socket: WebSocket | null = null

  const connect = (clientId: string, onMessage?: (message: ServerToClientMessage) => void): void => {
    socket = new WebSocket(url)

    socket.addEventListener('open', () => {
      socket?.send(JSON.stringify({ type: 'hello', clientId }))
    }) // end socket open listener

    socket.addEventListener('message', (event) => {
      let parsedRaw: unknown
      try {
        parsedRaw = JSON.parse(String(event.data))
      } catch {
        return
      } // end if invalid json

      const parsed = parseServerToClientMessage(parsedRaw)
      if (!parsed) {
        return
      } // end if failed schema validation

      onMessage?.(parsed)
    }) // end socket message listener
  } // end function connect

  const sendInput = (clientId: string, input: InputState): void => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return
    } // end if socket not open

    socket.send(JSON.stringify({ type: 'input', clientId, input }))
  } // end function sendInput

  const close = (): void => {
    if (!socket) {
      return
    } // end if no socket

    socket.close()
    socket = null
  } // end function close

  return {
    connect,
    sendInput,
    close
  } // end object ws client
} // end function createWsClient
