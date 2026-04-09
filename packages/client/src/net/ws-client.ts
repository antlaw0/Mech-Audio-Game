import {
  parseServerToClientMessage,
  type InputState,
  type ServerToClientMessage
} from '@mech-audio/shared'

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
