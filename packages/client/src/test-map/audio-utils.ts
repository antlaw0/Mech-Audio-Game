import { AUDIO_CONFIG } from './audio-config.js'
import type { WorldPosition, WorldVelocity } from './types.js'

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
} // end function clamp

export function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha
} // end function lerp

export function distanceToVolume(distance: number): number {
  const maxDistance = AUDIO_CONFIG.enemy.maxDistance
  const normalized = clamp(1 - distance / maxDistance, 0, 1)
  return Math.pow(normalized, 1.6)
} // end function distanceToVolume

export function distanceToFilter(distance: number): number {
  const normalized = clamp(distance / AUDIO_CONFIG.enemy.maxDistance, 0, 1)
  const near = 5200
  const far = 550
  return near + (far - near) * normalized
} // end function distanceToFilter

export function relativeVelocityForDoppler(enemyVelocity: WorldVelocity, playerVelocity: WorldVelocity): number {
  const rvx = enemyVelocity.x - playerVelocity.x
  const rvy = enemyVelocity.y - playerVelocity.y
  const rvz = enemyVelocity.z - playerVelocity.z
  return Math.hypot(rvx, rvy, rvz)
} // end function relativeVelocityForDoppler

export function bearingBetween(enemyPosition: WorldPosition, playerPosition: WorldPosition): number {
  return Math.atan2(enemyPosition.y - playerPosition.y, enemyPosition.x - playerPosition.x)
} // end function bearingBetween

export function normalizeAngle(angle: number): number {
  let wrapped = angle
  while (wrapped > Math.PI) {
    wrapped -= Math.PI * 2
  } // end while wrapped greater than PI
  while (wrapped < -Math.PI) {
    wrapped += Math.PI * 2
  } // end while wrapped lower than -PI
  return wrapped
} // end function normalizeAngle

export function worldToListenerSpace(
  source: WorldPosition,
  listener: WorldPosition,
  listenerAngle: number
): { x: number; y: number; z: number } {
  const dx = source.x - listener.x
  const dy = source.y - listener.y
  const dz = source.z - listener.z
  const right = dx * (-Math.sin(listenerAngle)) + dy * Math.cos(listenerAngle)
  const forward = dx * Math.cos(listenerAngle) + dy * Math.sin(listenerAngle)
  return {
    x: right,
    y: dz,
    z: -forward
  }
} // end function worldToListenerSpace
