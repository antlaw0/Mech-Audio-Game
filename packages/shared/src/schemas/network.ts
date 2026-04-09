import { z } from 'zod'
import type { ClientToServerMessage, ServerToClientMessage } from '../types/network.js'

export const InputStateSchema = z.object({
  moveForward: z.boolean(),
  moveBack: z.boolean(),
  strafeLeft: z.boolean(),
  strafeRight: z.boolean(),
  turnLeft: z.boolean(),
  turnRight: z.boolean(),
  lookUp: z.boolean(),
  lookDown: z.boolean()
})

const PlayerStateSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  angle: z.number(),
  pitch: z.number()
})

const SpriteSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  type: z.enum(['tree', 'rock']),
  radius: z.number().positive()
})

export const ClientToServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), clientId: z.string().min(1) }),
  z.object({
    type: z.literal('input'),
    clientId: z.string().min(1),
    input: InputStateSchema
  })
])

const SerializedWorldStateSchema = z.object({
  tick: z.number().int().nonnegative(),
  mapWidth: z.number().int().positive(),
  mapHeight: z.number().int().positive(),
  mapData: z.array(z.number().int().min(0).max(255)),
  sprites: z.array(SpriteSchema),
  players: z.record(z.string(), PlayerStateSchema)
})

export const ServerToClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('welcome'),
    clientId: z.string().min(1),
    player: PlayerStateSchema
  }),
  z.object({
    type: z.literal('snapshot'),
    world: SerializedWorldStateSchema
  })
])

export function parseClientToServerMessage(value: unknown): ClientToServerMessage | null {
  const result = ClientToServerMessageSchema.safeParse(value)
  if (!result.success) {
    return null
  } // end if invalid message
  return result.data as ClientToServerMessage
} // end function parseClientToServerMessage

export function parseServerToClientMessage(value: unknown): ServerToClientMessage | null {
  const result = ServerToClientMessageSchema.safeParse(value)
  if (!result.success) {
    return null
  } // end if invalid message
  return result.data as ServerToClientMessage
} // end function parseServerToClientMessage
