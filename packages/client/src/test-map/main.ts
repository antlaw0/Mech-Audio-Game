import {
  CANVAS_HEIGHT_LIMIT,
  CANVAS_WIDTH_LIMIT
} from './constants.js'
import { MUZZLE_FLASH_DURATION } from './constants.js'
import { createAudioController } from './audio.js'
import {
  createCombatEcsWorld,
  getCombatRenderState,
  spawnPlayerBullet,
  stepCombatEcsWorld
} from './combat-ecs.js'
import { bindInput } from './input.js'
import { computeObstructionAwareness } from './awareness.js'
import { createSweepingSonar } from './sonar.js'
import { createMapData } from './map-data.js'
import { createInputState, createPlayer } from './player-state.js'
import { renderFrame } from './render.js'
import { createSprites } from './sprites.js'
import { createUpdateState, updateFrame } from './update.js'

function getCanvasDimensions(): { width: number; height: number } {
  return {
    width: Math.min(window.innerWidth, CANVAS_WIDTH_LIMIT),
    height: Math.min(window.innerHeight, CANVAS_HEIGHT_LIMIT)
  } // end object dimensions
} // end function getCanvasDimensions

function setupCanvas(): {
  ctx: CanvasRenderingContext2D
  canvas: HTMLCanvasElement
  width: number
  height: number
} {
  const canvas = document.getElementById('gameCanvas')
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Expected #gameCanvas to be an HTMLCanvasElement.')
  } // end if invalid canvas

  const { width, height } = getCanvasDimensions()
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to acquire 2D context.')
  } // end if no context

  return { ctx, canvas, width, height } // end object setup result
} // end function setupCanvas

function startTestMap(): void {
  const { ctx, width, height } = setupCanvas()
  const awarenessStatusElement = document.getElementById('awarenessStatus')
  const sonarStatusElement = document.getElementById('sonarStatus')

  const mapData = createMapData()
  const sprites = createSprites()
  const player = createPlayer()
  const input = createInputState()
  const updateState = createUpdateState()
  const audio = createAudioController()
  const sweepingSonar = createSweepingSonar(mapData)
  const zBuffer = new Float32Array(width)

  bindInput(input, audio)
  const combatWorld = createCombatEcsWorld()

  let lastTimeMs = 0
  let previousPlayerX = player.x
  let previousPlayerY = player.y

  const gameLoop = (timestampMs: number): void => {
    const deltaSeconds = Math.min((timestampMs - lastTimeMs) / 1000, 0.05)
    lastTimeMs = timestampMs

    updateFrame(
      {
        mapData,
        sprites,
        player,
        input,
        audio,
        state: updateState
      },
      deltaSeconds
    )

    if (input.firePending) {
      input.firePending = false
      audio.fireGunshot()
      updateState.muzzleFlashTimer = MUZZLE_FLASH_DURATION
      spawnPlayerBullet(combatWorld, player)
    } // end if fire pending

    if (input.sonarPingPending) {
      input.sonarPingPending = false
      sweepingSonar.setEnabled(!sweepingSonar.isEnabled())
      if (sonarStatusElement) {
        sonarStatusElement.textContent = sweepingSonar.isEnabled()
          ? 'SONAR: SWEEPING'
          : 'SONAR: OFF'
      } // end if sonar status element exists
    } // end if sonar ping pending

    stepCombatEcsWorld(combatWorld, mapData, audio, player, deltaSeconds)
    const combatRender = getCombatRenderState(combatWorld)
    const awareness = computeObstructionAwareness(player, combatRender.tanks, mapData, sprites)

    sweepingSonar.updatePlayerPosition(player.x, player.y, (player.angle * 180) / Math.PI)

    audio.updateFrameAudio(
      deltaSeconds,
      {
        position: { x: player.x, y: player.y, z: 0 },
        angle: player.angle,
        velocity: {
          x: (player.x - previousPlayerX) / Math.max(deltaSeconds, 0.0001),
          y: (player.y - previousPlayerY) / Math.max(deltaSeconds, 0.0001),
          z: 0
        }
      },
      combatRender.tanks.map((tank) => ({
        id: `tank-${tank.id}`,
        type: 'tank',
        category: 'ground',
        position: { x: tank.x, y: tank.y, z: 0 },
        velocity: { x: tank.velocityX, y: tank.velocityY, z: 0 },
        facingAngle: tank.angle,
        isMoving: Math.hypot(tank.velocityX, tank.velocityY) > 0.05,
        isAlive: tank.alive,
        height: 0
      }))
    )
    audio.updateObstructionAwareness(deltaSeconds, awareness)

    if (awarenessStatusElement) {
      if (!awareness.hasTarget) {
        awarenessStatusElement.textContent = 'AWARENESS: NO TARGET'
      } else if (!awareness.isBlocked) {
        awarenessStatusElement.textContent = `AWARENESS: CLEAR PATH TO TANK (${awareness.targetDistance.toFixed(1)}m)`
      } else {
        const obstacleLabel = awareness.obstacleType ? awareness.obstacleType.toUpperCase() : 'UNKNOWN'
        awarenessStatusElement.textContent = `AWARENESS: BLOCKED BY ${obstacleLabel} (${awareness.obstacleDistance.toFixed(1)}m)`
      } // end if awareness status branch
    } // end if awareness status element exists

    if (sonarStatusElement) {
      const contextState = audio.getAudioContextState()
      if (contextState !== 'running') {
        sonarStatusElement.textContent = 'SONAR: AUDIO SUSPENDED (PRESS ANY KEY OR CLICK)'
      } else if (!sweepingSonar.isEnabled()) {
        sonarStatusElement.textContent = 'SONAR: OFF'
      } // end if context running and timer active
    } // end if sonar status element exists

    previousPlayerX = player.x
    previousPlayerY = player.y

    const muzzleFlashAlpha = updateState.muzzleFlashTimer / MUZZLE_FLASH_DURATION

    renderFrame({
      ctx,
      canvasWidth: width,
      canvasHeight: height,
      mapData,
      sprites,
      enemies: combatRender.enemies,
      tanks: combatRender.tanks,
      bullets: combatRender.bullets,
      player,
      zBuffer,
      muzzleFlashAlpha
    })

    requestAnimationFrame(gameLoop)
  } // end function gameLoop

  requestAnimationFrame((timestampMs) => {
    lastTimeMs = timestampMs
    requestAnimationFrame(gameLoop)
  }) // end initial animation frame
} // end function startTestMap

startTestMap()
