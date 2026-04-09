import type { PlayerState } from '../core/worldTypes.js'
import { vec2 } from '../utils/vector.js'

export const createPlayer = (x: number, y: number, heading: number): PlayerState => ({
  position: vec2(x, y),
  velocity: vec2(0, 0),
  heading,
  health: 100
})
