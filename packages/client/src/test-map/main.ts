import {
  CANVAS_HEIGHT_LIMIT,
  CANVAS_WIDTH_LIMIT
} from './constants.js'
import { MUZZLE_FLASH_DURATION } from './constants.js'
import { createAudioController } from './audio.js'
import {
  createCombatEcsWorld,
  getCombatRenderState,
  spawnRandomEnemy,
  spawnRandomTankFromConfig,
  spawnPlayerBullet,
  stepCombatEcsWorld
} from './combat-ecs.js'
import { getEnemyDefinition } from './enemies/index.js'
import type { EnemyDefinitionConfig, EnemyMovementPattern } from './enemies/enemyTypes.js'
import type { EnemyId } from './enemies/enemyTypes.js'
import { bindInput } from './input.js'
import { computeObstructionAwareness } from './awareness.js'
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
  const pauseOverlayElement = document.getElementById('pauseOverlay')
  const resumeButtonElement = document.getElementById('pauseResumeButton')
  const exitButtonElement = document.getElementById('pauseExitButton')

  const enemyEditorModalElement = document.getElementById('enemyEditorModal')
  const enemyEditorTitleElement = document.getElementById('enemyEditorTitle')
  const editorSpawnButtonElement = document.getElementById('editorSpawnButton')
  const editorCancelButtonElement = document.getElementById('editorCancelButton')

  const getInput = (id: string): HTMLInputElement | null => {
    const el = document.getElementById(id)
    return el instanceof HTMLInputElement ? el : null
  } // end function getInput
  const getSelect = (id: string): HTMLSelectElement | null => {
    const el = document.getElementById(id)
    return el instanceof HTMLSelectElement ? el : null
  } // end function getSelect

  const editorNameInput = getInput('editorName')
  const editorMaxHpInput = getInput('editorMaxHp')
  const editorCollisionRadiusInput = getInput('editorCollisionRadius')
  const editorMovementSpeedInput = getInput('editorMovementSpeed')
  const editorProjectileSpeedInput = getInput('editorProjectileSpeed')
  const editorShotDamageInput = getInput('editorShotDamage')
  const editorFireRateInput = getInput('editorFireRateSeconds')
  const editorThreatDelayInput = getInput('editorThreatDelaySeconds')
  const editorProjectileMaxDistInput = getInput('editorProjectileMaxDistance')
  const editorMovementPatternSelect = getSelect('editorMovementPattern')
  const editorRetargetIntervalInput = getInput('editorRetargetInterval')
  const editorEngageRangeInput = getInput('editorEngageRange')
  const editorLineOfSightInput = getInput('editorLineOfSight')
  const editorAttackSoundInput = getInput('editorAttackSound')
  const editorHurtSoundInput = getInput('editorHurtSound')
  const editorDeathSoundInput = getInput('editorDeathSound')
  const editorLoopSoundInput = getInput('editorLoopSound')

  const mapData = createMapData()
  const sprites = createSprites()
  const player = createPlayer()
  const input = createInputState()
  const updateState = createUpdateState()
  const audio = createAudioController()
  const zBuffer = new Float32Array(width)

  let isPaused = false
  let queuedEnemySpawn: EnemyDefinitionConfig | null = null
  let isEditorModalOpen = false
  let editorCurrentEnemyId: EnemyId = 'tank'

  const clearGameplayInputs = (): void => {
    input.moveForward = false
    input.moveBack = false
    input.strafeLeft = false
    input.strafeRight = false
    input.turnLeft = false
    input.turnRight = false
    input.lookUp = false
    input.lookDown = false
    input.pitchResetPending = false
    input.firePending = false
    input.sonarPingPending = false
    input.snapNorthPending = false
    input.snapEastPending = false
    input.snapSouthPending = false
    input.snapWestPending = false
    input.spawnTankPending = false
    input.spawnStrikerPending = false
    input.spawnBrutePending = false
  } // end function clearGameplayInputs

  const setPauseOverlayVisible = (visible: boolean): void => {
    if (!(pauseOverlayElement instanceof HTMLDivElement)) {
      return
    } // end if pause overlay element missing

    pauseOverlayElement.style.display = visible ? 'flex' : 'none'
    pauseOverlayElement.setAttribute('aria-hidden', visible ? 'false' : 'true')
  } // end function setPauseOverlayVisible

  const setEditorModalVisible = (visible: boolean): void => {
    if (!(enemyEditorModalElement instanceof HTMLDivElement)) {
      return
    } // end if editor modal element missing
    enemyEditorModalElement.style.display = visible ? 'flex' : 'none'
    enemyEditorModalElement.setAttribute('aria-hidden', visible ? 'false' : 'true')
  } // end function setEditorModalVisible

  const populateEditorForm = (config: EnemyDefinitionConfig): void => {
    if (editorNameInput) editorNameInput.value = config.name
    if (editorMaxHpInput) editorMaxHpInput.value = String(config.maxHp)
    if (editorCollisionRadiusInput) editorCollisionRadiusInput.value = String(config.collisionRadius)
    if (editorMovementSpeedInput) editorMovementSpeedInput.value = String(config.movementSpeed)
    if (editorProjectileSpeedInput) editorProjectileSpeedInput.value = String(config.projectileSpeed)
    if (editorShotDamageInput) editorShotDamageInput.value = String(config.shotDamage)
    if (editorFireRateInput) editorFireRateInput.value = String(config.fireRateSeconds)
    if (editorThreatDelayInput) editorThreatDelayInput.value = String(config.threatDelaySeconds)
    if (editorProjectileMaxDistInput) editorProjectileMaxDistInput.value = String(config.projectileMaxDistance)
    if (editorMovementPatternSelect) editorMovementPatternSelect.value = config.behavior.movementPattern
    if (editorRetargetIntervalInput) editorRetargetIntervalInput.value = String(config.behavior.retargetIntervalSeconds)
    if (editorEngageRangeInput) editorEngageRangeInput.value = String(config.behavior.preferredEngageRange)
    if (editorLineOfSightInput) editorLineOfSightInput.checked = config.behavior.lineOfSightRequiredToShoot
    if (editorAttackSoundInput) editorAttackSoundInput.value = config.sounds.attackSound
    if (editorHurtSoundInput) editorHurtSoundInput.value = config.sounds.hurtSound
    if (editorDeathSoundInput) editorDeathSoundInput.value = config.sounds.deathSound
    if (editorLoopSoundInput) editorLoopSoundInput.value = config.sounds.positionalLoopSound
  } // end function populateEditorForm

  const readEditorForm = (baseId: EnemyId): EnemyDefinitionConfig => {
    const def = getEnemyDefinition(baseId)
    const parseNum = (input: HTMLInputElement | null, fallback: number): number => {
      if (!input) return fallback
      const val = parseFloat(input.value)
      return isFinite(val) ? val : fallback
    } // end function parseNum
    return {
      id: baseId,
      name: editorNameInput?.value.trim() || def.name,
      maxHp: Math.max(1, Math.round(parseNum(editorMaxHpInput, def.maxHp))),
      collisionRadius: Math.max(0.05, parseNum(editorCollisionRadiusInput, def.collisionRadius)),
      movementSpeed: Math.max(0, parseNum(editorMovementSpeedInput, def.movementSpeed)),
      projectileSpeed: Math.max(1, parseNum(editorProjectileSpeedInput, def.projectileSpeed)),
      shotDamage: Math.max(1, Math.round(parseNum(editorShotDamageInput, def.shotDamage))),
      fireRateSeconds: Math.max(0.1, parseNum(editorFireRateInput, def.fireRateSeconds)),
      threatDelaySeconds: Math.max(0, parseNum(editorThreatDelayInput, def.threatDelaySeconds)),
      projectileMaxDistance: Math.max(1, parseNum(editorProjectileMaxDistInput, def.projectileMaxDistance)),
      behavior: {
        movementPattern: (editorMovementPatternSelect?.value as EnemyMovementPattern) || def.behavior.movementPattern,
        retargetIntervalSeconds: Math.max(0.5, parseNum(editorRetargetIntervalInput, def.behavior.retargetIntervalSeconds)),
        preferredEngageRange: Math.max(1, parseNum(editorEngageRangeInput, def.behavior.preferredEngageRange)),
        lineOfSightRequiredToShoot: editorLineOfSightInput?.checked ?? def.behavior.lineOfSightRequiredToShoot
      },
      sounds: {
        attackSound: editorAttackSoundInput?.value.trim() || def.sounds.attackSound,
        hurtSound: editorHurtSoundInput?.value.trim() || def.sounds.hurtSound,
        deathSound: editorDeathSoundInput?.value.trim() || def.sounds.deathSound,
        positionalLoopSound: editorLoopSoundInput?.value.trim() || def.sounds.positionalLoopSound
      }
    } // end object enemy config
  } // end function readEditorForm

  const openEnemyEditorModal = (enemyId: EnemyId): void => {
    editorCurrentEnemyId = enemyId
    const def = getEnemyDefinition(enemyId)
    if (enemyEditorTitleElement) {
      enemyEditorTitleElement.textContent = `Edit Enemy: ${def.name}`
    } // end if title element exists
    populateEditorForm(def)
    setEditorModalVisible(true)
    isEditorModalOpen = true
    editorNameInput?.focus()
  } // end function openEnemyEditorModal

  const closeEnemyEditorModal = (): void => {
    setEditorModalVisible(false)
    isEditorModalOpen = false
    if (resumeButtonElement instanceof HTMLButtonElement) {
      resumeButtonElement.focus()
    } // end if resume button exists
  } // end function closeEnemyEditorModal

  const pauseGame = async (): Promise<void> => {
    if (isPaused) {
      return
    } // end if already paused

    isPaused = true
    clearGameplayInputs()

    await audio.ensureAudio()
    audio.playPauseOpenChirp()
    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), 90)
    })
    await audio.pauseAllAudio()
    setPauseOverlayVisible(true)
  } // end function pauseGame

  const resumeGame = async (): Promise<void> => {
    if (!isPaused) {
      return
    } // end if not paused

    const pendingSpawnConfig = queuedEnemySpawn
    queuedEnemySpawn = null

    setPauseOverlayVisible(false)
    await audio.resumeAllAudio()
    audio.playPauseCloseChirp()
    isPaused = false
    lastTimeMs = performance.now()

    if (pendingSpawnConfig !== null) {
      spawnRandomTankFromConfig(combatWorld, mapData, player, pendingSpawnConfig)
    } // end if pending custom enemy spawn
  } // end function resumeGame

  const togglePause = async (): Promise<void> => {
    if (isPaused) {
      await resumeGame()
      return
    } // end if resuming

    await pauseGame()
  } // end function togglePause

  bindInput(input, audio, () => isPaused)

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Escape' || event.repeat) {
      return
    } // end if not pause toggle key

    event.preventDefault()

    if (isEditorModalOpen) {
      closeEnemyEditorModal()
      return
    } // end if closing editor modal

    void togglePause()
  })

  if (resumeButtonElement instanceof HTMLButtonElement) {
    resumeButtonElement.addEventListener('click', () => {
      void resumeGame()
    })
  } // end if resume button exists

  if (exitButtonElement instanceof HTMLButtonElement) {
    exitButtonElement.addEventListener('click', () => {
      window.location.href = './index.html'
    })
  } // end if exit button exists

  if (editorSpawnButtonElement instanceof HTMLButtonElement) {
    editorSpawnButtonElement.addEventListener('click', () => {
      queuedEnemySpawn = readEditorForm(editorCurrentEnemyId)
      closeEnemyEditorModal()
    })
  } // end if editor spawn button exists

  if (editorCancelButtonElement instanceof HTMLButtonElement) {
    editorCancelButtonElement.addEventListener('click', () => {
      closeEnemyEditorModal()
    })
  } // end if editor cancel button exists

  document.addEventListener('keydown', (event) => {
    if (!isPaused || isEditorModalOpen || event.repeat) {
      return
    } // end if not in pause-only editor trigger state

    if (event.code === 'Numpad1') {
      event.preventDefault()
      openEnemyEditorModal('tank')
    } else if (event.code === 'Numpad2') {
      event.preventDefault()
      openEnemyEditorModal('striker')
    } else if (event.code === 'Numpad3') {
      event.preventDefault()
      openEnemyEditorModal('brute')
    } // end if numpad enemy editor keys
  })

  const combatWorld = createCombatEcsWorld()

  let lastTimeMs = 0
  let previousPlayerX = player.x
  let previousPlayerY = player.y

  const gameLoop = (timestampMs: number): void => {
    const deltaSeconds = Math.min((timestampMs - lastTimeMs) / 1000, 0.05)
    lastTimeMs = timestampMs

    if (isPaused) {
      requestAnimationFrame(gameLoop)
      return
    } // end if game paused

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

    const pendingManualPing = input.sonarPingPending
    input.sonarPingPending = false

    if (input.spawnTankPending) {
      input.spawnTankPending = false
      const spawned = spawnRandomEnemy(combatWorld, mapData, player, 'tank')
      if (awarenessStatusElement) {
        awarenessStatusElement.textContent = spawned
          ? 'AWARENESS: TANK SPAWNED'
          : 'AWARENESS: NO VALID SPAWN LOCATION'
      } // end if awareness status element exists
    } // end if spawn tank pending

    if (input.spawnStrikerPending) {
      input.spawnStrikerPending = false
      const spawned = spawnRandomEnemy(combatWorld, mapData, player, 'striker')
      if (awarenessStatusElement) {
        awarenessStatusElement.textContent = spawned
          ? 'AWARENESS: STRIKER SPAWNED'
          : 'AWARENESS: NO VALID SPAWN LOCATION'
      } // end if awareness status element exists
    } // end if spawn striker pending

    if (input.spawnBrutePending) {
      input.spawnBrutePending = false
      const spawned = spawnRandomEnemy(combatWorld, mapData, player, 'brute')
      if (awarenessStatusElement) {
        awarenessStatusElement.textContent = spawned
          ? 'AWARENESS: BRUTE SPAWNED'
          : 'AWARENESS: NO VALID SPAWN LOCATION'
      } // end if awareness status element exists
    } // end if spawn brute pending

    stepCombatEcsWorld(combatWorld, mapData, audio, player, deltaSeconds)
    const combatRender = getCombatRenderState(combatWorld)
    const awareness = computeObstructionAwareness(player, combatRender.tanks, mapData, sprites)

    const playerAudioState = {
      position: { x: player.x, y: player.y, z: 0 },
      angle: player.angle,
      velocity: {
        x: (player.x - previousPlayerX) / Math.max(deltaSeconds, 0.0001),
        y: (player.y - previousPlayerY) / Math.max(deltaSeconds, 0.0001),
        z: 0
      }
    }
    const enemyAudioStates = combatRender.tanks.map((tank) => ({
      id: `tank-${tank.id}`,
      type: 'tank',
      category: 'ground',
      position: { x: tank.x, y: tank.y, z: 0 },
      radius: tank.radius,
      velocity: { x: tank.velocityX, y: tank.velocityY, z: 0 },
      facingAngle: tank.angle,
      isMoving: Math.hypot(tank.velocityX, tank.velocityY) > 0.05,
      isAlive: tank.alive,
      height: 0
    }))

    if (pendingManualPing) {
      audio.triggerActiveSonar(playerAudioState, enemyAudioStates, mapData, sprites)
    } // end if manual sonar ping was requested

    audio.updateFrameAudio(
      deltaSeconds,
      playerAudioState,
      enemyAudioStates,
      mapData,
      sprites
    )

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
      } else {
        sonarStatusElement.textContent = pendingManualPing
          ? 'SONAR: PASSIVE SWEEP ACTIVE | MANUAL PING FIRED'
          : 'SONAR: PASSIVE SWEEP ACTIVE | E: MANUAL PING'
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
