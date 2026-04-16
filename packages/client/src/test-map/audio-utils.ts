import * as Tone from 'tone'
import { AUDIO_CONFIG, AUDIO_NAVIGATION_CONFIG } from './audio-config.js'
import { MAP_HEIGHT, MAP_WIDTH, MAX_DEPTH } from './constants.js'
import type { EnemyAudioState, SpriteObject, WorldPosition, WorldVelocity } from './types.js'
import { type WorldCollisionWorld } from './world-collision.js'

export interface TileRayHit {
  hit: boolean
  col: number
  row: number
  distance: number
  type: 'none' | 'wall' | 'boundary'
  worldX: number
  worldY: number
}

export interface SonarContact {
  kind: 'enemy' | 'wall' | 'boundary' | 'tree' | 'rock'
  distance: number
  worldAngle: number
  bearing: number
  worldX: number
  worldY: number
  col: number
  row: number
  enemyId?: string
}

interface CueUtilityState {
  proximityPanner: Tone.Panner
  proximityFilter: Tone.Filter
  proximityGain: Tone.Gain
  proximityOscillator: Tone.Oscillator
  collisionPanner: Tone.Panner
  collisionSynth: Tone.MembraneSynth
  cardinalSynth: Tone.PolySynth<Tone.Synth>
}

let cueUtilityState: CueUtilityState | null = null

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
} // end function clamp

export function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha
} // end function lerp

export function distanceToVolume(distance: number, maxRange: number = AUDIO_CONFIG.enemy.maxDistance): number {
  return clamp(1 - distance / Math.max(maxRange, 0.001), 0.05, 1)
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

export function getBearing(playerFacing: number, worldAngle: number): number {
  return normalizeAngle(worldAngle - playerFacing)
} // end function getBearing

export function sortByDistance<T extends { distance: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.distance - b.distance)
} // end function sortByDistance

export function filterClosest<T extends { distance: number }>(list: T[], count: number): T[] {
  return sortByDistance(list).slice(0, Math.max(0, count))
} // end function filterClosest

export function getRayHit(
  world: WorldCollisionWorld,
  startPos: { x: number; y: number },
  angle: number,
  maxDistance = MAX_DEPTH
): TileRayHit {
  const dirX = Math.cos(angle)
  const dirY = Math.sin(angle)
  let col = Math.floor(startPos.x)
  let row = Math.floor(startPos.y)

  const deltaX = Math.abs(1 / (dirX === 0 ? 1e-10 : dirX))
  const deltaY = Math.abs(1 / (dirY === 0 ? 1e-10 : dirY))
  const stepCol = dirX < 0 ? -1 : 1
  const stepRow = dirY < 0 ? -1 : 1
  let sideX = dirX < 0 ? (startPos.x - col) * deltaX : (col + 1 - startPos.x) * deltaX
  let sideY = dirY < 0 ? (startPos.y - row) * deltaY : (row + 1 - startPos.y) * deltaY
  let side: 0 | 1 = 0

  for (;;) {
    if (Math.min(sideX, sideY) > maxDistance) {
      break
    } // end if ray has exceeded max distance

    if (sideX < sideY) {
      sideX += deltaX
      col += stepCol
      side = 0
    } else {
      sideY += deltaY
      row += stepRow
      side = 1
    } // end if stepping on X or Y axis

    if (col < 0 || col >= MAP_WIDTH || row < 0 || row >= MAP_HEIGHT) {
      break
    } // end if ray left map bounds

    if (world.wallSet.has(row * MAP_WIDTH + col)) {
      const dist = side === 0
        ? (col - startPos.x + (1 - stepCol) / 2) / dirX
        : (row - startPos.y + (1 - stepRow) / 2) / dirY

      if (dist > maxDistance) {
        break
      } // end if hit is past max distance

      const isBoundary = col <= 0 || col >= MAP_WIDTH - 1 || row <= 0 || row >= MAP_HEIGHT - 1
      return {
        hit: true,
        col,
        row,
        distance: dist,
        type: isBoundary ? 'boundary' : 'wall',
        worldX: startPos.x + dirX * dist,
        worldY: startPos.y + dirY * dist
      }
    } // end if wall cell hit
  } // end for DDA loop

  return {
    hit: false,
    col,
    row,
    distance: maxDistance,
    type: 'none',
    worldX: startPos.x + dirX * maxDistance,
    worldY: startPos.y + dirY * maxDistance
  }
} // end function getRayHit

function intersectCircleOnRay(
  startPos: { x: number; y: number },
  angle: number,
  centerX: number,
  centerY: number,
  radius: number,
  maxDistance: number
): number | null {
  const dirX = Math.cos(angle)
  const dirY = Math.sin(angle)
  const offsetX = startPos.x - centerX
  const offsetY = startPos.y - centerY
  const b = 2 * (offsetX * dirX + offsetY * dirY)
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius
  const discriminant = b * b - 4 * c
  if (discriminant < 0) {
    return null
  } // end if no circle intersection

  const sqrtDiscriminant = Math.sqrt(discriminant)
  const t0 = (-b - sqrtDiscriminant) / 2
  const t1 = (-b + sqrtDiscriminant) / 2
  const distance = t0 >= 0 ? t0 : t1 >= 0 ? t1 : null
  if (distance === null || distance > maxDistance) {
    return null
  } // end if hit is behind origin or out of range

  return distance
} // end function intersectCircleOnRay

function getNearestSpriteContact(
  sprites: SpriteObject[],
  startPos: { x: number; y: number },
  angle: number,
  playerFacing: number,
  maxDistance: number
): SonarContact | null {
  let nearest: SonarContact | null = null

  for (const sprite of sprites) {
    const distance = intersectCircleOnRay(startPos, angle, sprite.x, sprite.y, sprite.radius, maxDistance)
    if (distance === null) {
      continue
    } // end if sprite is not on ray

    nearest = !nearest || distance < nearest.distance
      ? {
          kind: sprite.type,
          distance,
          worldAngle: angle,
          bearing: getBearing(playerFacing, angle),
          worldX: startPos.x + Math.cos(angle) * distance,
          worldY: startPos.y + Math.sin(angle) * distance,
          col: Math.floor(startPos.x + Math.cos(angle) * distance),
          row: Math.floor(startPos.y + Math.sin(angle) * distance)
        }
      : nearest
  } // end for each sprite

  return nearest
} // end function getNearestSpriteContact

function getNearestEnemyContact(
  enemies: EnemyAudioState[],
  startPos: { x: number; y: number },
  angle: number,
  playerFacing: number,
  maxDistance: number
): SonarContact | null {
  let nearest: SonarContact | null = null

  for (const enemy of enemies) {
    if (!enemy.isAlive) {
      continue
    } // end if enemy is dead

    const radius = Math.max(enemy.radius, 0.25)
    const distance = intersectCircleOnRay(startPos, angle, enemy.position.x, enemy.position.y, radius, maxDistance)
    if (distance === null) {
      continue
    } // end if enemy is not on ray

    nearest = !nearest || distance < nearest.distance
      ? {
          kind: 'enemy',
          distance,
          worldAngle: angle,
          bearing: getBearing(playerFacing, angle),
          worldX: startPos.x + Math.cos(angle) * distance,
          worldY: startPos.y + Math.sin(angle) * distance,
          col: Math.floor(startPos.x + Math.cos(angle) * distance),
          row: Math.floor(startPos.y + Math.sin(angle) * distance),
          enemyId: enemy.id
        }
      : nearest
  } // end for each enemy

  return nearest
} // end function getNearestEnemyContact

export function scanSonarContact(
  world: WorldCollisionWorld,
  startPos: { x: number; y: number },
  playerFacing: number,
  angle: number,
  sprites: SpriteObject[],
  enemies: EnemyAudioState[],
  obstacleMaxDistance: number,
  enemyMaxDistance: number
): SonarContact | null {
  const wallHit = getRayHit(world, startPos, angle, obstacleMaxDistance)
  const wallContact = wallHit.hit
    ? {
        kind: wallHit.type,
        distance: wallHit.distance,
        worldAngle: angle,
        bearing: getBearing(playerFacing, angle),
        worldX: wallHit.worldX,
        worldY: wallHit.worldY,
        col: wallHit.col,
        row: wallHit.row
      }
    : null
  const spriteContact = getNearestSpriteContact(sprites, startPos, angle, playerFacing, obstacleMaxDistance)
  const obstacleContact = filterClosest(
    [wallContact, spriteContact].filter((value): value is SonarContact => value !== null),
    1
  )[0] ?? null
  const enemyContact = getNearestEnemyContact(enemies, startPos, angle, playerFacing, enemyMaxDistance)

  if (enemyContact && (!obstacleContact || enemyContact.distance < obstacleContact.distance + 1)) {
    return enemyContact
  } // end if enemy should override obstacle clutter

  return obstacleContact
} // end function scanSonarContact

export function hasLineOfSight(
  world: WorldCollisionWorld,
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const targetDistance = Math.hypot(to.x - from.x, to.y - from.y)
  const hit = getRayHit(world, from, angle, targetDistance)
  return !hit.hit || hit.distance >= targetDistance - 0.05
} // end function hasLineOfSight

export function findNearestObstacleContact(
  world: WorldCollisionWorld,
  startPos: { x: number; y: number },
  playerFacing: number,
  sprites: SpriteObject[],
  maxDistance: number = AUDIO_NAVIGATION_CONFIG.nearFieldRadius,
  rayCount: number = 24
): SonarContact | null {
  const contacts: SonarContact[] = []
  for (let index = 0; index < rayCount; index += 1) {
    const angle = (index / rayCount) * Math.PI * 2
    const contact = scanSonarContact(world, startPos, playerFacing, angle, sprites, [], maxDistance, 0)
    if (contact && contact.kind !== 'enemy') {
      contacts.push(contact)
    } // end if obstacle contact found
  } // end for each sample ray

  return filterClosest(contacts, 1)[0] ?? null
} // end function findNearestObstacleContact

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

export function initializeAudioCueUtilities(): void {
  if (cueUtilityState) {
    return
  } // end if cue utility graph already exists

  const proximityPanner = new Tone.Panner(0).toDestination()
  const proximityFilter = new Tone.Filter(300, 'lowpass').connect(proximityPanner)
  const proximityGain = new Tone.Gain(0).connect(proximityFilter)
  const proximityOscillator = new Tone.Oscillator({ frequency: 300, type: 'sine' }).connect(proximityGain)
  proximityOscillator.start()

  const collisionPanner = new Tone.Panner(0).toDestination()
  const collisionSynth = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 1.5,
    envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.05 }
  }).connect(collisionPanner)

  const cardinalSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.06 }
  }).toDestination()

  cueUtilityState = {
    proximityPanner,
    proximityFilter,
    proximityGain,
    proximityOscillator,
    collisionPanner,
    collisionSynth,
    cardinalSynth
  }
} // end function initializeAudioCueUtilities

export function playWallProximityCue(direction: number, intensity: number, gainScale = 1): void {
  if (!cueUtilityState) {
    return
  } // end if cue utility graph not initialized

  cueUtilityState.proximityFilter.frequency.rampTo(300 + intensity * 120, 0.03)
  cueUtilityState.proximityPanner.pan.rampTo(clamp(Math.sin(direction), -1, 1), 0.03)
  cueUtilityState.proximityGain.gain.rampTo(clamp(intensity * 0.18 * gainScale, 0, 0.36), 0.03)
} // end function playWallProximityCue

export function silenceWallProximityCue(): void {
  if (!cueUtilityState) {
    return
  } // end if cue utility graph not initialized

  cueUtilityState.proximityGain.gain.rampTo(0, 0.04)
} // end function silenceWallProximityCue

export function playCollisionThud(direction: number, gainScale = 1): void {
  if (!cueUtilityState) {
    return
  } // end if cue utility graph not initialized

  cueUtilityState.collisionPanner.pan.rampTo(clamp(Math.sin(direction), -1, 1), 0.01)
  cueUtilityState.collisionSynth.volume.value = Tone.gainToDb(clamp(gainScale, 0.001, 2))
  cueUtilityState.collisionSynth.triggerAttackRelease('C2', '32n')
} // end function playCollisionThud

export function playCardinalOrientationCue(newFacing: number, gainScale = 1): void {
  if (!cueUtilityState) {
    return
  } // end if cue utility graph not initialized

  const now = Tone.now()
  cueUtilityState.cardinalSynth.volume.value = Tone.gainToDb(clamp(gainScale, 0.001, 2))
  const northDelta = Math.abs(normalizeAngle(newFacing + Math.PI / 2))
  const eastDelta = Math.abs(normalizeAngle(newFacing))
  const southDelta = Math.abs(normalizeAngle(newFacing - Math.PI / 2))
  const westDelta = Math.abs(normalizeAngle(newFacing - Math.PI))

  if (northDelta <= eastDelta && northDelta <= southDelta && northDelta <= westDelta) {
    cueUtilityState.cardinalSynth.triggerAttackRelease(['C5', 'E5', 'G5'], '16n', now)
    return
  } // end if north cue selected

  if (eastDelta <= southDelta && eastDelta <= westDelta) {
    cueUtilityState.cardinalSynth.triggerAttackRelease(['E6'], '16n', now)
    return
  } // end if east cue selected

  if (southDelta <= westDelta) {
    cueUtilityState.cardinalSynth.triggerAttackRelease(['G5', 'E5', 'C5'], '16n', now)
    return
  } // end if south cue selected

  cueUtilityState.cardinalSynth.triggerAttackRelease(['C4'], '32n', now)
  cueUtilityState.cardinalSynth.triggerAttackRelease(['C4'], '32n', now + 0.08)
} // end function playCardinalOrientationCue
