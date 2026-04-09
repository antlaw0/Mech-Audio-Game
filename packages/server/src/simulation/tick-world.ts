import type { InputState, WorldState } from '@mech-audio/shared'
import { applyInput } from './apply-input.js'

export function tickWorld(
  world: WorldState,
  inputsByPlayerId: Map<string, InputState>,
  deltaSeconds: number
): void {
  world.tick += 1

  for (const [playerId, player] of Object.entries(world.players)) {
    const input = inputsByPlayerId.get(playerId)
    if (!input) {
      continue
    } // end if no input

    applyInput(world, player, input, deltaSeconds)
  } // end for each player
} // end function tickWorld
