import {
  CANVAS_HEIGHT_LIMIT,
  CANVAS_WIDTH_LIMIT,
  MAP_HEIGHT,
  MAP_WIDTH,
  MUZZLE_FLASH_DURATION,
  MAX_LOOK_PITCH,
  PLAYER_FLIGHT_SPEED,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  WEAPON_DEFAULT_ACCURACY
} from './constants.js'
import { createAudioController } from './audio.js'
import {
  createCombatEcsWorld,
  getCombatRenderState,
  spawnRandomEnemy,
  spawnRandomTankFromConfig,
  spawnPlayerBullet,
  spawnPlayerBulletToward,
  spawnPlayerMissile,
  syncDynamicFlightHeights,
  stepCombatEcsWorld
} from './combat-ecs.js'
import { createTargetLockState, updateTargetLock } from './target-lock.js'
import { getEnemyDefinition } from './enemies/index.js'
import type { EnemyDefinitionConfig, EnemyMovementPattern } from './enemies/enemyTypes.js'
import type { EnemyId } from './enemies/enemyTypes.js'
import { getSharedFlightHeight, setSharedFlightHeight } from './runtime-config.js'
import type { WeaponStats } from './types.js'
import { PLAYER_WEAPON_DEFINITIONS, type PlayerWeaponDefinition } from './weapons.js'
import { bindInput } from './input.js'
import { computeObstructionAwareness } from './awareness.js'
import { createDeveloperConsole } from './dev-console.js'
import { createMapData } from './map-data.js'
import { createInputState, createPlayer } from './player-state.js'
import { createSprites } from './sprites.js'
import { createThreeRenderSystem } from './three-render.js'
import { createUpdateState, updateFrame } from './update.js'
import { createWorldCollisionWorld, isPlayerBlocked, PLAYER_COLLISION_HEIGHT } from './world-collision.js'
import type { AudioCategory, AudioVolumeChannel } from './types.js'

interface TestMapDevConsole {
  help(): string[]
  execute(commandLine: string): Promise<string[]>
  getState(): {
    sharedFlightHeight: number
    player: {
      x: number
      y: number
      z: number
      flightState: string
      isFlying: boolean
    }
    weapon: WeaponStats
    paused: boolean
  }
  setSharedFlightHeight(value: number): number
  setPlayerAltitude(value: number): number
  spawnEnemy(enemyId: EnemyId): boolean
  pause(): Promise<void>
  resume(): Promise<void>
} // end interface TestMapDevConsole

interface DeveloperConsoleBinding {
  description: string
  helpPath: string[]
  get: () => unknown
  set?: (rawValue: string) => unknown
} // end interface DeveloperConsoleBinding

interface DeveloperConsoleCommandHelp {
  syntax: string
  description: string
  helpPath: string[]
  aliases?: string[]
  examples?: string[]
} // end interface DeveloperConsoleCommandHelp

interface DeveloperConsoleHelpNode {
  title: string
  description?: string
  lines?: string[]
  children?: DeveloperConsoleHelpNode[]
} // end interface DeveloperConsoleHelpNode

declare global {
  interface Window {
    mechDev?: TestMapDevConsole
  }
} // end declare global

function getCanvasDimensions(): { width: number; height: number } {
  return {
    width: Math.min(window.innerWidth, CANVAS_WIDTH_LIMIT),
    height: Math.min(window.innerHeight, CANVAS_HEIGHT_LIMIT)
  } // end object dimensions
} // end function getCanvasDimensions

function setupCanvas(): {
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

  return { canvas, width, height } // end object setup result
} // end function setupCanvas

function startTestMap(): void {
  const { canvas, width, height } = setupCanvas()

  const getInput = (id: string): HTMLInputElement | null => {
    const el = document.getElementById(id)
    return el instanceof HTMLInputElement ? el : null
  } // end function getInput
  const getSelect = (id: string): HTMLSelectElement | null => {
    const el = document.getElementById(id)
    return el instanceof HTMLSelectElement ? el : null
  } // end function getSelect

  const awarenessStatusElement = document.getElementById('awarenessStatus')
  const sonarStatusElement = document.getElementById('sonarStatus')
  const playerStatusElement = document.getElementById('playerStatus')
  const pauseOverlayElement = document.getElementById('pauseOverlay')
  const resumeButtonElement = document.getElementById('pauseResumeButton')
  const exitButtonElement = document.getElementById('pauseExitButton')
  const devConsoleOverlayElement = document.getElementById('devConsoleOverlay')
  const devConsoleOutputElement = document.getElementById('devConsoleOutput')
  const devConsoleInputElement = document.getElementById('devConsoleInput')
  const devConsoleStatusElement = document.getElementById('devConsoleStatus')

  const enemyEditorModalElement = document.getElementById('enemyEditorModal')
  const enemyEditorTitleElement = document.getElementById('enemyEditorTitle')
  const editorSpawnButtonElement = document.getElementById('editorSpawnButton')
  const editorCancelButtonElement = document.getElementById('editorCancelButton')

  const weaponEditorModalElement = document.getElementById('weaponEditorModal')
  const weaponEditorApplyButtonElement = document.getElementById('weaponEditorApplyButton')
  const weaponEditorCancelButtonElement = document.getElementById('weaponEditorCancelButton')
  const weaponAccuracyInput = getInput('weaponAccuracy')
  const weaponDamageInput = getInput('weaponDamage')
  const weaponProjectileCountInput = getInput('weaponProjectileCount')
  const weaponSpreadInput = getInput('weaponSpread')
  const weaponBulletSpeedInput = getInput('weaponBulletSpeed')
  const weaponMaxRangeInput = getInput('weaponMaxRange')
  const weaponFireRateInput = getInput('weaponFireRate')
  const weaponFullAutoInput = getInput('weaponFullAuto')
  const weaponLockOnRangeInput = getInput('weaponLockOnRange')
  const weaponLockOnWindowWidthInput = getInput('weaponLockOnWindowWidth')
  const weaponLockOnWindowHeightInput = getInput('weaponLockOnWindowHeight')

  const editorNameInput = getInput('editorName')
  const editorMaxHpInput = getInput('editorMaxHp')
  const editorCollisionRadiusInput = getInput('editorCollisionRadius')
  const editorMovementSpeedInput = getInput('editorMovementSpeed')
  const editorAirborneInput = getInput('editorAirborne')
  const editorFlightHeightInput = getInput('editorFlightHeight')
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
  const collisionWorld = createWorldCollisionWorld(mapData, sprites)
  const threeRenderer = createThreeRenderSystem({
    canvas,
    canvasWidth: width,
    canvasHeight: height,
    mapData,
    sprites
  })
  const player = createPlayer()
  const input = createInputState()
  const updateState = createUpdateState()
  const audio = createAudioController()

  let isPaused = false
  let isConsoleOpen = false
  let consoleResumeOnClose = false
  let queuedEnemySpawn: EnemyDefinitionConfig | null = null
  let isEditorModalOpen = false
  let editorCurrentEnemyId: EnemyId = 'tank'
  let isWeaponEditorOpen = false
  let playerFireCooldownSeconds = 0

  const weaponLoadout: PlayerWeaponDefinition[] = PLAYER_WEAPON_DEFINITIONS.map((weapon) => ({
    ...weapon,
    explosionSounds: [...weapon.explosionSounds]
  }))
  let activeWeaponIndex = 0
  let playerWeapon = weaponLoadout[activeWeaponIndex]!
  let missileLockProgressMs = 0
  let missileLockTargetId: number | null = null
  let missileLockConfirmed = false
  let missileLockToneTimerSeconds = 0

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
    input.fireHeld = false
    input.firePending = false
    input.flightTogglePending = false
    input.sonarPingPending = false
    input.snapNorthPending = false
    input.snapEastPending = false
    input.snapSouthPending = false
    input.snapWestPending = false
    input.cycleWeaponPending = false
    input.selectedWeaponSlot = null
    input.spawnTankPending = false
    input.spawnStrikerPending = false
    input.spawnBrutePending = false
    input.spawnHelicopterPending = false
    input.refillEpPending = false
    input.refillHpPending = false
    input.speakHpPending = false
    input.speakEpPending = false
  } // end function clearGameplayInputs

  const equipWeaponAtIndex = (requestedIndex: number): void => {
    if (weaponLoadout.length === 0) {
      return
    } // end if weapon loadout is empty

    const normalizedIndex = Math.min(Math.max(requestedIndex, 0), weaponLoadout.length - 1)
    activeWeaponIndex = normalizedIndex
    playerWeapon = weaponLoadout[activeWeaponIndex] ?? weaponLoadout[0]!
    playerFireCooldownSeconds = 0
    targetLockState.lockedTankId = null
    missileLockProgressMs = 0
    missileLockTargetId = null
    missileLockConfirmed = false
    missileLockToneTimerSeconds = 0
    audio.playLockLostChirp()

    if (awarenessStatusElement) {
      awarenessStatusElement.textContent = `WEAPON: ${playerWeapon.name.toUpperCase()} [${playerWeapon.selectionKey}]`
    } // end if awareness status element exists
  } // end function equipWeaponAtIndex

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

  const setWeaponEditorModalVisible = (visible: boolean): void => {
    if (!(weaponEditorModalElement instanceof HTMLDivElement)) {
      return
    } // end if weapon editor modal element missing
    weaponEditorModalElement.style.display = visible ? 'flex' : 'none'
    weaponEditorModalElement.setAttribute('aria-hidden', visible ? 'false' : 'true')
  } // end function setWeaponEditorModalVisible

  const populateWeaponEditorForm = (stats: WeaponStats): void => {
    if (weaponAccuracyInput) weaponAccuracyInput.value = String(stats.accuracy)
    if (weaponDamageInput) weaponDamageInput.value = String(stats.damagePerShot)
    if (weaponProjectileCountInput) weaponProjectileCountInput.value = String(stats.projectileCount)
    if (weaponSpreadInput) weaponSpreadInput.value = String(stats.spreadDegrees)
    if (weaponBulletSpeedInput) weaponBulletSpeedInput.value = String(stats.bulletSpeed)
    if (weaponMaxRangeInput) weaponMaxRangeInput.value = String(stats.maxRange)
    if (weaponFireRateInput) weaponFireRateInput.value = String(stats.fireRateCooldownSeconds)
    if (weaponFullAutoInput) weaponFullAutoInput.checked = stats.isFullAuto
    if (weaponLockOnRangeInput) weaponLockOnRangeInput.value = String(stats.lockOnRange)
    if (weaponLockOnWindowWidthInput) weaponLockOnWindowWidthInput.value = String(stats.lockOnWindowWidthPercent)
    if (weaponLockOnWindowHeightInput) weaponLockOnWindowHeightInput.value = String(stats.lockOnWindowHeightPercent)
  } // end function populateWeaponEditorForm

  const readWeaponEditorForm = (): WeaponStats => {
    const parseNum = (input: HTMLInputElement | null, fallback: number): number => {
      if (!input) return fallback
      const val = parseFloat(input.value)
      return isFinite(val) ? val : fallback
    } // end function parseNum
    return {
      weaponType: playerWeapon.weaponType,
      accuracy: Math.max(0.01, Math.min(1, parseNum(weaponAccuracyInput, playerWeapon.accuracy))),
      damagePerShot: Math.max(1, Math.round(parseNum(weaponDamageInput, playerWeapon.damagePerShot))),
      projectileCount: Math.max(1, Math.round(parseNum(weaponProjectileCountInput, playerWeapon.projectileCount))),
      spreadDegrees: Math.max(0, parseNum(weaponSpreadInput, playerWeapon.spreadDegrees)),
      bulletSpeed: Math.max(1, parseNum(weaponBulletSpeedInput, playerWeapon.bulletSpeed)),
      maxRange: Math.max(1, parseNum(weaponMaxRangeInput, playerWeapon.maxRange)),
      isFullAuto: weaponFullAutoInput?.checked ?? playerWeapon.isFullAuto,
      fireRateCooldownSeconds: Math.max(0, parseNum(weaponFireRateInput, playerWeapon.fireRateCooldownSeconds)),
      projectileSize: Math.max(0.03, playerWeapon.projectileSize),
      lockOnRange: Math.max(1, parseNum(weaponLockOnRangeInput, playerWeapon.lockOnRange)),
      lockOnWindowWidthPercent: Math.max(0, Math.min(100, Math.round(parseNum(weaponLockOnWindowWidthInput, playerWeapon.lockOnWindowWidthPercent)))),
      lockOnWindowHeightPercent: Math.max(0, Math.min(100, Math.round(parseNum(weaponLockOnWindowHeightInput, playerWeapon.lockOnWindowHeightPercent)))),
      lockOnTimeMs: playerWeapon.lockOnTimeMs,
      trackingRating: playerWeapon.trackingRating,
      explosionRadius: playerWeapon.explosionRadius,
      explosionDamage: playerWeapon.explosionDamage,
      explosionSounds: [...playerWeapon.explosionSounds]
    } // end object weapon stats
  } // end function readWeaponEditorForm

  const openWeaponEditor = (): void => {
    populateWeaponEditorForm(playerWeapon)
    setWeaponEditorModalVisible(true)
    isWeaponEditorOpen = true
    weaponAccuracyInput?.focus()
  } // end function openWeaponEditor

  const closeWeaponEditor = (): void => {
    setWeaponEditorModalVisible(false)
    isWeaponEditorOpen = false
  } // end function closeWeaponEditor

  const populateEditorForm = (config: EnemyDefinitionConfig): void => {
    if (editorNameInput) editorNameInput.value = config.name
    if (editorMaxHpInput) editorMaxHpInput.value = String(config.maxHp)
    if (editorCollisionRadiusInput) editorCollisionRadiusInput.value = String(config.collisionRadius)
    if (editorAirborneInput) editorAirborneInput.checked = config.airborne
    if (editorFlightHeightInput) editorFlightHeightInput.value = String(config.flightHeight)
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
      airborne: editorAirborneInput?.checked ?? def.airborne,
      flightHeight: Math.max(0, parseNum(editorFlightHeightInput, def.flightHeight)),
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

  const enterPausedState = async (showPauseOverlay: boolean): Promise<void> => {
    clearGameplayInputs()

    if (!isPaused) {
      isPaused = true
      await audio.ensureAudio()
      audio.playPauseOpenChirp()
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 90)
      })
      await audio.pauseAllAudio()
    } // end if game was not already paused

    setPauseOverlayVisible(showPauseOverlay)
  } // end function enterPausedState

  const pauseGame = async (): Promise<void> => {
    await enterPausedState(true)
  } // end function pauseGame

  const resumeGame = async (): Promise<void> => {
    if (!isPaused) {
      return
    } // end if not paused

    if (isConsoleOpen) {
      isConsoleOpen = false
      devConsole?.close()
    } // end if console is still open while resuming

    const pendingSpawnConfig = queuedEnemySpawn
    queuedEnemySpawn = null

    setPauseOverlayVisible(false)
    await audio.resumeAllAudio()
    audio.playPauseCloseChirp()
    isPaused = false
    lastTimeMs = performance.now()

    if (pendingSpawnConfig !== null) {
      spawnRandomTankFromConfig(combatWorld, collisionWorld, player, pendingSpawnConfig)
    } // end if pending custom enemy spawn
  } // end function resumeGame

  const togglePause = async (): Promise<void> => {
    if (isPaused) {
      await resumeGame()
      return
    } // end if resuming

    await pauseGame()
  } // end function togglePause

  bindInput(input, audio, () => isPaused || isWeaponEditorOpen || isConsoleOpen)

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Escape' || event.repeat) {
      return
    } // end if not pause toggle key

    event.preventDefault()

    if (isConsoleOpen) {
      void closeDeveloperConsole()
      return
    } // end if closing developer console first

    if (isEditorModalOpen) {
      closeEnemyEditorModal()
      return
    } // end if closing editor modal

    if (isWeaponEditorOpen) {
      closeWeaponEditor()
      return
    } // end if closing weapon editor

    void togglePause()
  })

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Backquote' || event.repeat || isEditorModalOpen || isWeaponEditorOpen) {
      return
    } // end if not developer console key or another editor is open

    event.preventDefault()
    if (isConsoleOpen) {
      void closeDeveloperConsole()
      return
    } // end if toggling console closed

    void openDeveloperConsole()
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

  if (weaponEditorApplyButtonElement instanceof HTMLButtonElement) {
    weaponEditorApplyButtonElement.addEventListener('click', () => {
      Object.assign(playerWeapon, readWeaponEditorForm())
      closeWeaponEditor()
    })
  } // end if weapon apply button exists

  if (weaponEditorCancelButtonElement instanceof HTMLButtonElement) {
    weaponEditorCancelButtonElement.addEventListener('click', () => {
      closeWeaponEditor()
    })
  } // end if weapon cancel button exists

  document.addEventListener('keydown', (event) => {
    if (!isPaused || isConsoleOpen || isEditorModalOpen || event.repeat) {
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
    } else if (event.code === 'Numpad4') {
      event.preventDefault()
      openEnemyEditorModal('helicopter')
    } // end if numpad enemy editor keys
  })

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Numpad0' || event.repeat || isEditorModalOpen || isWeaponEditorOpen || isConsoleOpen) {
      return
    } // end if not weapon editor key or already open
    event.preventDefault()
    openWeaponEditor()
  })

  const combatWorld = createCombatEcsWorld()
  const targetLockState = createTargetLockState()
  let lastTimeMs = 0
  let previousPlayerX = player.x
  let previousPlayerY = player.y
  let previousPlayerZ = player.z ?? 0

  const applySharedFlightHeight = (value: number): number => {
    const nextHeight = setSharedFlightHeight(value)
    syncDynamicFlightHeights(combatWorld)

    if (player.flightState === 'airborne') {
      player.z = nextHeight
      player.isFlying = nextHeight > 0
    } // end if player already airborne

    return nextHeight
  } // end function applySharedFlightHeight

  const syncTrackedPlayerPosition = (): void => {
    previousPlayerX = player.x
    previousPlayerY = player.y
    previousPlayerZ = player.z ?? 0
  } // end function syncTrackedPlayerPosition

  const parseFiniteNumber = (rawValue: string, label: string): number => {
    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) {
      throw new Error(`${label} must be a finite number.`)
    } // end if parsed value is invalid
    return parsed
  } // end function parseFiniteNumber

  const parseBooleanValue = (rawValue: string): boolean => {
    const normalized = rawValue.trim().toLowerCase()
    if (['true', '1', 'on', 'yes'].includes(normalized)) {
      return true
    } // end if truthy token
    if (['false', '0', 'off', 'no'].includes(normalized)) {
      return false
    } // end if falsy token
    throw new Error(`Expected boolean value, received "${rawValue}".`)
  } // end function parseBooleanValue

  const speakPercent = (label: string, value: number, maxValue: number): void => {
    if (!('speechSynthesis' in window)) {
      return
    } // end if speech synthesis unavailable

    const safeMax = Math.max(1, maxValue)
    const percent = Math.max(0, Math.min(100, Math.round((value / safeMax) * 100)))
    const utterance = new SpeechSynthesisUtterance(`${label} ${percent} percent`)
    utterance.rate = 1
    utterance.pitch = 1
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  } // end function speakPercent

  const normalizeDegrees = (value: number): number => {
    let normalized = value % 360
    if (normalized < 0) {
      normalized += 360
    } // end if negative wrapped angle
    return normalized
  } // end function normalizeDegrees

  const tokenizeCommandLine = (commandLine: string): string[] => {
    const tokens: string[] = []
    let current = ''
    let quote: '"' | '\'' | null = null

    for (let index = 0; index < commandLine.length; index += 1) {
      const char = commandLine[index]
      if (!char) {
        continue
      } // end if char missing

      if (quote !== null) {
        if (char === quote) {
          quote = null
        } else {
          current += char
        } // end if quote closes or content continues
        continue
      } // end if inside quotes

      if (char === '"' || char === '\'') {
        quote = char
        continue
      } // end if quote begins

      if (/\s/.test(char)) {
        if (current.length > 0) {
          tokens.push(current)
          current = ''
        } // end if token completed by whitespace
        continue
      } // end if whitespace found

      current += char
    } // end for each command character

    if (current.length > 0) {
      tokens.push(current)
    } // end if final token remains

    return tokens
  } // end function tokenizeCommandLine

  const formatConsoleValue = (value: unknown): string => {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? String(value) : value.toFixed(3)
    } // end if numeric value
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false'
    } // end if boolean value
    if (typeof value === 'string') {
      return value
    } // end if string value
    return JSON.stringify(value, null, 2)
  } // end function formatConsoleValue

  const setPlayerAltitude = (value: number): number => {
    const nextAltitude = Math.max(0, value)
    player.z = nextAltitude
    player.isFlying = nextAltitude > 0
    player.flightState = nextAltitude > 0 ? 'airborne' : 'grounded'
    syncTrackedPlayerPosition()
    return nextAltitude
  } // end function setPlayerAltitude

  const setPlayerFlightState = (value: string): string => {
    const normalized = value.trim().toLowerCase()
    if (!['grounded', 'ascending', 'airborne', 'descending'].includes(normalized)) {
      throw new Error('player.flightState must be grounded, ascending, airborne, or descending.')
    } // end if invalid flight state

    player.flightState = normalized as typeof player.flightState
    player.isFlying = normalized !== 'grounded'
    if (!player.isFlying) {
      player.z = 0
    } else if ((player.z ?? 0) <= 0) {
      player.z = getSharedFlightHeight()
    } // end if state requires airborne altitude
    syncTrackedPlayerPosition()
    return player.flightState ?? 'grounded'
  } // end function setPlayerFlightState

  const placePlayer = (nextX: number, nextY: number, nextZ: number = player.z ?? 0): string => {
    const clampedX = Math.max(PLAYER_RADIUS + 0.01, Math.min(MAP_WIDTH - PLAYER_RADIUS - 0.01, nextX))
    const clampedY = Math.max(PLAYER_RADIUS + 0.01, Math.min(MAP_HEIGHT - PLAYER_RADIUS - 0.01, nextY))
    const clampedZ = Math.max(0, nextZ)
    if (isPlayerBlocked(collisionWorld, clampedX, clampedY, clampedZ, PLAYER_RADIUS, PLAYER_COLLISION_HEIGHT)) {
      throw new Error('Requested player position intersects world geometry.')
    } // end if requested position is blocked

    player.x = clampedX
    player.y = clampedY
    setPlayerAltitude(clampedZ)
    syncTrackedPlayerPosition()
    return `Player moved to (${player.x.toFixed(2)}, ${player.y.toFixed(2)}, ${(player.z ?? 0).toFixed(2)})`
  } // end function placePlayer

  const setPlayerAngleDegrees = (value: number): number => {
    const nextAngle = normalizeDegrees(value)
    player.angle = (nextAngle * Math.PI) / 180
    return nextAngle
  } // end function setPlayerAngleDegrees

  const setPlayerPitchDegrees = (value: number): number => {
    const maxPitchDegrees = (MAX_LOOK_PITCH * 180) / Math.PI
    const nextPitchDegrees = Math.max(-maxPitchDegrees, Math.min(maxPitchDegrees, value))
    player.pitch = (nextPitchDegrees * Math.PI) / 180
    return nextPitchDegrees
  } // end function setPlayerPitchDegrees

  const audioCategories: AudioCategory[] = ['proximity', 'objects', 'enemies', 'navigation']
  const enemyIds: EnemyId[] = ['tank', 'striker', 'brute', 'helicopter']

  const getStateLines = (): string[] => [
    `paused = ${isPaused}`,
    `console.open = ${isConsoleOpen}`,
    `player = x:${player.x.toFixed(2)} y:${player.y.toFixed(2)} z:${(player.z ?? 0).toFixed(2)} angle:${((player.angle * 180) / Math.PI).toFixed(1)} pitch:${((player.pitch * 180) / Math.PI).toFixed(1)}`,
    `player.flight = state:${player.flightState ?? 'grounded'} flying:${player.isFlying ? 'true' : 'false'} sharedHeight:${getSharedFlightHeight().toFixed(2)}`,
    `weapon = type:${playerWeapon.weaponType} accuracy:${playerWeapon.accuracy.toFixed(2)} pellets:${playerWeapon.projectileCount} spread:${playerWeapon.spreadDegrees.toFixed(1)} damage:${playerWeapon.damagePerShot} speed:${playerWeapon.bulletSpeed.toFixed(2)} range:${playerWeapon.maxRange.toFixed(2)} fullAuto:${playerWeapon.isFullAuto} fireRate:${playerWeapon.fireRateCooldownSeconds.toFixed(2)}`,
    `audio volumes = master:${audio.getVolumeChannel('master').toFixed(2)} ambience:${audio.getVolumeChannel('ambience').toFixed(2)} footsteps:${audio.getVolumeChannel('footsteps').toFixed(2)} servo:${audio.getVolumeChannel('servo').toFixed(2)}`,
    `audio categories = proximity:${audio.getCategoryEnabled('proximity')}@${audio.getVolumeChannel('proximity').toFixed(2)} objects:${audio.getCategoryEnabled('objects')}@${audio.getVolumeChannel('objects').toFixed(2)} enemies:${audio.getCategoryEnabled('enemies')}@${audio.getVolumeChannel('enemies').toFixed(2)} navigation:${audio.getCategoryEnabled('navigation')}@${audio.getVolumeChannel('navigation').toFixed(2)}`
  ]

  const getConsoleBindings = (): Record<string, DeveloperConsoleBinding> => ({
    'player.x': {
      description: 'Player world X position.',
      helpPath: ['Player', 'Position'],
      get: () => player.x,
      set: (rawValue) => {
        placePlayer(parseFiniteNumber(rawValue, 'player.x'), player.y, player.z ?? 0)
        return player.x
      }
    },
    'player.y': {
      description: 'Player world Y position.',
      helpPath: ['Player', 'Position'],
      get: () => player.y,
      set: (rawValue) => {
        placePlayer(player.x, parseFiniteNumber(rawValue, 'player.y'), player.z ?? 0)
        return player.y
      }
    },
    'player.z': {
      description: 'Player altitude above ground.',
      helpPath: ['Player', 'Position'],
      get: () => player.z ?? 0,
      set: (rawValue) => {
        placePlayer(player.x, player.y, parseFiniteNumber(rawValue, 'player.z'))
        return player.z ?? 0
      }
    },
    'player.angle': {
      description: 'Player facing angle in degrees.',
      helpPath: ['Player', 'View'],
      get: () => (player.angle * 180) / Math.PI,
      set: (rawValue) => setPlayerAngleDegrees(parseFiniteNumber(rawValue, 'player.angle'))
    },
    'player.pitch': {
      description: 'Player look pitch in degrees.',
      helpPath: ['Player', 'View'],
      get: () => (player.pitch * 180) / Math.PI,
      set: (rawValue) => setPlayerPitchDegrees(parseFiniteNumber(rawValue, 'player.pitch'))
    },
    'player.isFlying': {
      description: 'Whether the player is airborne.',
      helpPath: ['Player', 'Flight'],
      get: () => !!player.isFlying,
      set: (rawValue) => {
        const enabled = parseBooleanValue(rawValue)
        if (!enabled) {
          return setPlayerAltitude(0) > 0
        } // end if disabling flight
        if ((player.z ?? 0) <= 0) {
          setPlayerAltitude(getSharedFlightHeight())
        } // end if player needs lift to fly
        player.isFlying = true
        player.flightState = 'airborne'
        return !!player.isFlying
      }
    },
    'player.flightState': {
      description: 'Player flight state: grounded, ascending, airborne, or descending.',
      helpPath: ['Player', 'Flight'],
      get: () => player.flightState ?? 'grounded',
      set: (rawValue) => setPlayerFlightState(rawValue)
    },
    'flight.sharedHeight': {
      description: 'Shared airborne hover height used by the player and dynamic flight sync.',
      helpPath: ['Environment', 'Flight'],
      get: () => getSharedFlightHeight(),
      set: (rawValue) => applySharedFlightHeight(parseFiniteNumber(rawValue, 'flight.sharedHeight'))
    },
    'weapon.accuracy': {
      description: 'Player weapon accuracy from 0 to 1.',
      helpPath: ['Weapon', 'Combat'],
      get: () => playerWeapon.accuracy,
      set: (rawValue) => {
        playerWeapon.accuracy = Math.max(0.01, Math.min(1, parseFiniteNumber(rawValue, 'weapon.accuracy')))
        return playerWeapon.accuracy
      }
    },
    'weapon.damagePerShot': {
      description: 'Player weapon damage per shot.',
      helpPath: ['Weapon', 'Combat'],
      get: () => playerWeapon.damagePerShot,
      set: (rawValue) => {
        playerWeapon.damagePerShot = Math.max(1, Math.round(parseFiniteNumber(rawValue, 'weapon.damagePerShot')))
        return playerWeapon.damagePerShot
      }
    },
    'weapon.projectileCount': {
      description: 'Number of projectiles fired simultaneously each time the weapon shoots.',
      helpPath: ['Weapon', 'Combat'],
      get: () => playerWeapon.projectileCount,
      set: (rawValue) => {
        playerWeapon.projectileCount = Math.max(1, Math.round(parseFiniteNumber(rawValue, 'weapon.projectileCount')))
        return playerWeapon.projectileCount
      }
    },
    'weapon.projectilesPerShot': {
      description: 'Alias for weapon.projectileCount.',
      helpPath: ['Weapon', 'Combat'],
      get: () => playerWeapon.projectileCount,
      set: (rawValue) => {
        playerWeapon.projectileCount = Math.max(1, Math.round(parseFiniteNumber(rawValue, 'weapon.projectilesPerShot')))
        return playerWeapon.projectileCount
      }
    },
    'weapon.spread': {
      description: 'Per-projectile spread cone half-angle in degrees.',
      helpPath: ['Weapon', 'Combat'],
      get: () => playerWeapon.spreadDegrees,
      set: (rawValue) => {
        playerWeapon.spreadDegrees = Math.max(0, parseFiniteNumber(rawValue, 'weapon.spread'))
        return playerWeapon.spreadDegrees
      }
    },
    'weapon.spreadDegrees': {
      description: 'Alias for weapon.spread in degrees.',
      helpPath: ['Weapon', 'Combat'],
      get: () => playerWeapon.spreadDegrees,
      set: (rawValue) => {
        playerWeapon.spreadDegrees = Math.max(0, parseFiniteNumber(rawValue, 'weapon.spreadDegrees'))
        return playerWeapon.spreadDegrees
      }
    },
    'weapon.bulletSpeed': {
      description: 'Player weapon projectile speed.',
      helpPath: ['Weapon', 'Combat'],
      get: () => playerWeapon.bulletSpeed,
      set: (rawValue) => {
        playerWeapon.bulletSpeed = Math.max(1, parseFiniteNumber(rawValue, 'weapon.bulletSpeed'))
        return playerWeapon.bulletSpeed
      }
    },
    'weapon.maxRange': {
      description: 'Player weapon maximum range.',
      helpPath: ['Weapon', 'Combat'],
      get: () => playerWeapon.maxRange,
      set: (rawValue) => {
        playerWeapon.maxRange = Math.max(1, parseFiniteNumber(rawValue, 'weapon.maxRange'))
        return playerWeapon.maxRange
      }
    },
    'weapon.projectileSize': {
      description: 'Projectile collision radius in world units.',
      helpPath: ['Weapon', 'Combat'],
      get: () => playerWeapon.projectileSize,
      set: (rawValue) => {
        playerWeapon.projectileSize = Math.max(0.03, parseFiniteNumber(rawValue, 'weapon.projectileSize'))
        return playerWeapon.projectileSize
      }
    },
    'weapon.isFullAuto': {
      description: 'Whether holding fire continuously shoots while cooldown allows.',
      helpPath: ['Weapon', 'Combat'],
      get: () => playerWeapon.isFullAuto,
      set: (rawValue) => {
        playerWeapon.isFullAuto = parseBooleanValue(rawValue)
        return playerWeapon.isFullAuto
      }
    },
    'weapon.fullAuto': {
      description: 'Alias for weapon.isFullAuto.',
      helpPath: ['Weapon', 'Combat'],
      get: () => playerWeapon.isFullAuto,
      set: (rawValue) => {
        playerWeapon.isFullAuto = parseBooleanValue(rawValue)
        return playerWeapon.isFullAuto
      }
    },
    'weapon.fireRateCooldownSeconds': {
      description: 'Seconds between player shots.',
      helpPath: ['Weapon', 'Combat'],
      get: () => playerWeapon.fireRateCooldownSeconds,
      set: (rawValue) => {
        playerWeapon.fireRateCooldownSeconds = Math.max(0, parseFiniteNumber(rawValue, 'weapon.fireRateCooldownSeconds'))
        return playerWeapon.fireRateCooldownSeconds
      }
    },
    'weapon.fireRate': {
      description: 'Alias for weapon.fireRateCooldownSeconds.',
      helpPath: ['Weapon', 'Combat'],
      get: () => playerWeapon.fireRateCooldownSeconds,
      set: (rawValue) => {
        playerWeapon.fireRateCooldownSeconds = Math.max(0, parseFiniteNumber(rawValue, 'weapon.fireRate'))
        return playerWeapon.fireRateCooldownSeconds
      }
    },
    'weapon.lockOnRange': {
      description: 'Target-lock acquisition range.',
      helpPath: ['Weapon', 'Lock-On'],
      get: () => playerWeapon.lockOnRange,
      set: (rawValue) => {
        playerWeapon.lockOnRange = Math.max(1, parseFiniteNumber(rawValue, 'weapon.lockOnRange'))
        return playerWeapon.lockOnRange
      }
    },
    'weapon.lockOnWindowWidthPercent': {
      description: 'Horizontal lock window percentage.',
      helpPath: ['Weapon', 'Lock-On'],
      get: () => playerWeapon.lockOnWindowWidthPercent,
      set: (rawValue) => {
        playerWeapon.lockOnWindowWidthPercent = Math.max(0, Math.min(100, Math.round(parseFiniteNumber(rawValue, 'weapon.lockOnWindowWidthPercent'))))
        return playerWeapon.lockOnWindowWidthPercent
      }
    },
    'weapon.lockOnWindowHeightPercent': {
      description: 'Vertical lock window percentage.',
      helpPath: ['Weapon', 'Lock-On'],
      get: () => playerWeapon.lockOnWindowHeightPercent,
      set: (rawValue) => {
        playerWeapon.lockOnWindowHeightPercent = Math.max(0, Math.min(100, Math.round(parseFiniteNumber(rawValue, 'weapon.lockOnWindowHeightPercent'))))
        return playerWeapon.lockOnWindowHeightPercent
      }
    },
    'weapon.lockOnTimeMs': {
      description: 'Missile lock confirmation time in milliseconds.',
      helpPath: ['Weapon', 'Lock-On'],
      get: () => playerWeapon.lockOnTimeMs,
      set: (rawValue) => {
        playerWeapon.lockOnTimeMs = Math.max(0, Math.round(parseFiniteNumber(rawValue, 'weapon.lockOnTimeMs')))
        return playerWeapon.lockOnTimeMs
      }
    },
    'weapon.trackingRating': {
      description: 'Missile tracking strength from 0 to 1.',
      helpPath: ['Weapon', 'Lock-On'],
      get: () => playerWeapon.trackingRating,
      set: (rawValue) => {
        playerWeapon.trackingRating = Math.max(0, Math.min(1, parseFiniteNumber(rawValue, 'weapon.trackingRating')))
        return playerWeapon.trackingRating
      }
    },
    'weapon.explosionRadius': {
      description: 'Missile explosion radius in world units.',
      helpPath: ['Weapon', 'Combat'],
      get: () => playerWeapon.explosionRadius,
      set: (rawValue) => {
        playerWeapon.explosionRadius = Math.max(0.2, parseFiniteNumber(rawValue, 'weapon.explosionRadius'))
        return playerWeapon.explosionRadius
      }
    },
    'weapon.explosionDamage': {
      description: 'Missile explosion base damage before falloff.',
      helpPath: ['Weapon', 'Combat'],
      get: () => playerWeapon.explosionDamage,
      set: (rawValue) => {
        playerWeapon.explosionDamage = Math.max(1, parseFiniteNumber(rawValue, 'weapon.explosionDamage'))
        return playerWeapon.explosionDamage
      }
    },
    'aimAssist.enabled': {
      description: 'Aim assist enabled flag.',
      helpPath: ['Gameplay', 'Aim Assist'],
      get: () => audio.isAimAssistEnabled(),
      set: (rawValue) => {
        const enabled = parseBooleanValue(rawValue)
        audio.setAimAssistEnabled(enabled)
        return audio.isAimAssistEnabled()
      }
    },
    'audio.master.volume': {
      description: 'Master volume scalar from 0 to 2.',
      helpPath: ['Audio', 'Mix'],
      get: () => audio.getVolumeChannel('master'),
      set: (rawValue) => audio.setVolumeChannel('master', parseFiniteNumber(rawValue, 'audio.master.volume'))
    },
    'audio.ambience.volume': {
      description: 'Ambience volume scalar from 0 to 2.',
      helpPath: ['Audio', 'Mix'],
      get: () => audio.getVolumeChannel('ambience'),
      set: (rawValue) => audio.setVolumeChannel('ambience', parseFiniteNumber(rawValue, 'audio.ambience.volume'))
    },
    'audio.footsteps.volume': {
      description: 'Footstep volume scalar from 0 to 2.',
      helpPath: ['Audio', 'Mix'],
      get: () => audio.getVolumeChannel('footsteps'),
      set: (rawValue) => audio.setVolumeChannel('footsteps', parseFiniteNumber(rawValue, 'audio.footsteps.volume'))
    },
    'audio.servo.volume': {
      description: 'Servo motor volume scalar from 0 to 2.',
      helpPath: ['Audio', 'Mix'],
      get: () => audio.getVolumeChannel('servo'),
      set: (rawValue) => audio.setVolumeChannel('servo', parseFiniteNumber(rawValue, 'audio.servo.volume'))
    },
    'audio.flightLoop.volume': {
      description: 'Player flight loop volume scalar from 0 to 2.',
      helpPath: ['Audio', 'Mix'],
      get: () => audio.getVolumeChannel('flightLoop'),
      set: (rawValue) => audio.setVolumeChannel('flightLoop', parseFiniteNumber(rawValue, 'audio.flightLoop.volume'))
    },
    'audio.proximity.enabled': {
      description: 'Enable or disable the proximity audio category.',
      helpPath: ['Audio', 'Categories'],
      get: () => audio.getCategoryEnabled('proximity'),
      set: (rawValue) => audio.setCategoryEnabled('proximity', parseBooleanValue(rawValue))
    },
    'audio.objects.enabled': {
      description: 'Enable or disable the objects audio category.',
      helpPath: ['Audio', 'Categories'],
      get: () => audio.getCategoryEnabled('objects'),
      set: (rawValue) => audio.setCategoryEnabled('objects', parseBooleanValue(rawValue))
    },
    'audio.enemies.enabled': {
      description: 'Enable or disable the enemies audio category.',
      helpPath: ['Audio', 'Categories'],
      get: () => audio.getCategoryEnabled('enemies'),
      set: (rawValue) => audio.setCategoryEnabled('enemies', parseBooleanValue(rawValue))
    },
    'audio.navigation.enabled': {
      description: 'Enable or disable the navigation audio category.',
      helpPath: ['Audio', 'Categories'],
      get: () => audio.getCategoryEnabled('navigation'),
      set: (rawValue) => audio.setCategoryEnabled('navigation', parseBooleanValue(rawValue))
    },
    'audio.proximity.volume': {
      description: 'Proximity audio volume scalar from 0 to 2.',
      helpPath: ['Audio', 'Categories'],
      get: () => audio.getVolumeChannel('proximity'),
      set: (rawValue) => audio.setVolumeChannel('proximity', parseFiniteNumber(rawValue, 'audio.proximity.volume'))
    },
    'audio.objects.volume': {
      description: 'Objects audio volume scalar from 0 to 2.',
      helpPath: ['Audio', 'Categories'],
      get: () => audio.getVolumeChannel('objects'),
      set: (rawValue) => audio.setVolumeChannel('objects', parseFiniteNumber(rawValue, 'audio.objects.volume'))
    },
    'audio.enemies.volume': {
      description: 'Enemies audio volume scalar from 0 to 2.',
      helpPath: ['Audio', 'Categories'],
      get: () => audio.getVolumeChannel('enemies'),
      set: (rawValue) => audio.setVolumeChannel('enemies', parseFiniteNumber(rawValue, 'audio.enemies.volume'))
    },
    'audio.navigation.volume': {
      description: 'Navigation audio volume scalar from 0 to 2.',
      helpPath: ['Audio', 'Categories'],
      get: () => audio.getVolumeChannel('navigation'),
      set: (rawValue) => audio.setVolumeChannel('navigation', parseFiniteNumber(rawValue, 'audio.navigation.volume'))
    }
  })

  const commandHelp: DeveloperConsoleCommandHelp[] = [
    {
      syntax: 'help [topic]',
      description: 'Open categorized help, or jump directly to a command, binding, or category.',
      helpPath: ['Console', 'Reference'],
      examples: ['help', 'help weapon.fireRate', 'help audio']
    },
    {
      syntax: 'state',
      description: 'Print a high-level snapshot of gameplay, weapon, and audio state.',
      helpPath: ['Gameplay', 'Session'],
      aliases: ['status']
    },
    {
      syntax: 'list [prefix]',
      description: 'List every editable path, optionally filtered by prefix.',
      helpPath: ['Console', 'Reference'],
      aliases: ['paths'],
      examples: ['list', 'list weapon.', 'paths audio.']
    },
    {
      syntax: 'get <path>',
      description: 'Read the current value of a bound property.',
      helpPath: ['Console', 'Reference'],
      examples: ['get player.x', 'get weapon.fireRate']
    },
    {
      syntax: 'set <path> <value>',
      description: 'Set a bound property to a numeric, boolean, or string value.',
      helpPath: ['Console', 'Editing'],
      examples: ['set weapon.fireRate 0.5', 'set player.angle 270', 'set audio.enemies.enabled false']
    },
    {
      syntax: 'toggle <path>',
      description: 'Invert a boolean path such as audio.enemies.enabled.',
      helpPath: ['Console', 'Editing'],
      examples: ['toggle audio.navigation.enabled', 'toggle weapon.fullAuto']
    },
    {
      syntax: 'spawn <enemyId>',
      description: 'Spawn an enemy: tank, striker, brute, or helicopter.',
      helpPath: ['Enemies', 'Spawning'],
      examples: ['spawn tank', 'spawn helicopter']
    },
    {
      syntax: 'tp <x> <y> [z]',
      description: 'Teleport the player to a validated world position.',
      helpPath: ['Player', 'Position'],
      aliases: ['teleport'],
      examples: ['tp 18 20 0', 'teleport 24 24']
    },
    {
      syntax: 'pause',
      description: 'Pause the game and keep the console open.',
      helpPath: ['Gameplay', 'Session']
    },
    {
      syntax: 'resume',
      description: 'Resume gameplay and close the console.',
      helpPath: ['Gameplay', 'Session']
    },
    {
      syntax: 'close',
      description: 'Close the console and return to the previous pause state.',
      helpPath: ['Gameplay', 'Session']
    },
    {
      syntax: 'clear',
      description: 'Clear the console output buffer.',
      helpPath: ['Console', 'Utility']
    }
  ]

  const getSortedBindingPaths = (prefix = ''): string[] => Object.keys(getConsoleBindings())
    .filter((path) => path.startsWith(prefix))
    .sort((left, right) => left.localeCompare(right))

  const topLevelHelpCategories: Array<{ title: string; description: string }> = [
    { title: 'Audio', description: 'Audio mix, categories, and assist settings.' },
    { title: 'Gameplay', description: 'Session control and gameplay-wide settings.' },
    { title: 'Player', description: 'Player position, view, and flight controls.' },
    { title: 'Weapon', description: 'Weapon combat and lock-on tuning.' },
    { title: 'Enemies', description: 'Enemy-related commands.' },
    { title: 'Environment', description: 'Shared world and environment settings.' },
    { title: 'Console', description: 'Developer console reference and editing commands.' }
  ]

  let helpMenuSelectionPath: number[] | null = null

  const createHelpLeafForBinding = (path: string, binding: DeveloperConsoleBinding): DeveloperConsoleHelpNode => {
    const currentValue = binding.get()
    const lines = [
      `Binding: ${path}`,
      `Description: ${binding.description}`,
      'Syntax:',
      `  get ${path}`
    ]

    if (binding.set) {
      lines.push(`  set ${path} <value>`)
    } // end if binding is writable

    if (binding.set && typeof currentValue === 'boolean') {
      lines.push(`  toggle ${path}`)
    } // end if binding can be toggled

    lines.push(`Current value: ${formatConsoleValue(currentValue)}`)
    lines.push(`Writable: ${binding.set ? 'true' : 'false'}`)

    return {
      title: path,
      lines
    }
  } // end function createHelpLeafForBinding

  const createHelpLeafForCommand = (entry: DeveloperConsoleCommandHelp): DeveloperConsoleHelpNode => {
    const lines = [
      `Syntax: ${entry.syntax}`,
      `Description: ${entry.description}`
    ]

    if (entry.aliases && entry.aliases.length > 0) {
      lines.push(`Aliases: ${entry.aliases.join(', ')}`)
    } // end if command has aliases

    if (entry.examples && entry.examples.length > 0) {
      lines.push('Examples:')
      for (const example of entry.examples) {
        lines.push(`  ${example}`)
      } // end for each example
    } // end if command has examples

    return {
      title: entry.syntax,
      lines
    }
  } // end function createHelpLeafForCommand

  const sortHelpNode = (node: DeveloperConsoleHelpNode): void => {
    if (!node.children || node.children.length === 0) {
      return
    } // end if node has no children to sort

    node.children.sort((left, right) => left.title.localeCompare(right.title))
    for (const child of node.children) {
      sortHelpNode(child)
    } // end for each child node
  } // end function sortHelpNode

  const getOrCreateHelpCategoryNode = (
    node: DeveloperConsoleHelpNode,
    title: string,
    description?: string
  ): DeveloperConsoleHelpNode => {
    if (!node.children) {
      node.children = []
    } // end if node needs child list

    let child = node.children.find((entry) => entry.title === title && entry.lines === undefined)
    if (!child) {
      child = { title, description, children: [] }
      node.children.push(child)
    } else if (description && !child.description) {
      child.description = description
    } // end if child existed without description

    return child
  } // end function getOrCreateHelpCategoryNode

  const buildHelpTree = (): DeveloperConsoleHelpNode => {
    const root: DeveloperConsoleHelpNode = {
      title: 'Help',
      children: topLevelHelpCategories.map((category) => ({
        title: category.title,
        description: category.description,
        children: []
      }))
    }

    const bindings = getConsoleBindings()
    for (const [path, binding] of Object.entries(bindings)) {
      let currentNode = getOrCreateHelpCategoryNode(root, binding.helpPath[0] ?? 'Console')
      for (let index = 1; index < binding.helpPath.length; index += 1) {
        currentNode = getOrCreateHelpCategoryNode(currentNode, binding.helpPath[index] ?? 'General')
      } // end for each binding help segment
      currentNode.children ??= []
      currentNode.children.push(createHelpLeafForBinding(path, binding))
    } // end for each binding

    for (const entry of commandHelp) {
      let currentNode = getOrCreateHelpCategoryNode(root, entry.helpPath[0] ?? 'Console')
      for (let index = 1; index < entry.helpPath.length; index += 1) {
        currentNode = getOrCreateHelpCategoryNode(currentNode, entry.helpPath[index] ?? 'General')
      } // end for each command help segment
      currentNode.children ??= []
      currentNode.children.push(createHelpLeafForCommand(entry))
    } // end for each command help entry

    for (const child of root.children ?? []) {
      sortHelpNode(child)
    } // end for each top-level category

    return root
  } // end function buildHelpTree

  const getHelpNodeBySelectionPath = (selectionPath: number[]): DeveloperConsoleHelpNode | null => {
    let currentNode: DeveloperConsoleHelpNode | null = buildHelpTree()
    for (const selectionIndex of selectionPath) {
      const children: DeveloperConsoleHelpNode[] = currentNode?.children ?? []
      const nextNode: DeveloperConsoleHelpNode | undefined = children[selectionIndex]
      if (!nextNode) {
        return null
      } // end if invalid selection index
      currentNode = nextNode
    } // end for each selection path index
    return currentNode
  } // end function getHelpNodeBySelectionPath

  const formatHelpMenuLines = (selectionPath: number[] = []): string[] => {
    const node = getHelpNodeBySelectionPath(selectionPath)
    if (!node) {
      helpMenuSelectionPath = []
      return ['Help navigation reset.', 'Select one of these help categories:', ...((buildHelpTree().children ?? []).map((child, index) => `${index + 1}. ${child.title}`))]
    } // end if current help node could not be resolved

    const children = node.children ?? []
    const isRoot = selectionPath.length === 0
    const lines: string[] = []

    if (isRoot) {
      lines.push('Select one of these help categories:')
      lines.push(...children.map((child, index) => `${index + 1}. ${child.title}`))
      lines.push('Enter a number to open that help category.')
      return lines
    } // end if root menu requested

    lines.push(`Showing help for ${node.title}.`)
    if (node.description) {
      lines.push(node.description)
    } // end if node has description

    if (children.length > 0) {
      lines.push(`Select a subcategory for ${node.title}:`)
      lines.push(...children.map((child, index) => `${index + 1}. ${child.title}`))
    } else if (node.lines && node.lines.length > 0) {
      lines.push(...node.lines)
    } else {
      lines.push('No detailed help is available for this item yet.')
    } // end if node is a category or leaf

    lines.push('0. Back')
    lines.push('Type help to return to the top help categories.')
    return lines
  } // end function formatHelpMenuLines

  const findCommandHelpEntry = (topic: string): DeveloperConsoleCommandHelp | undefined => {
    const normalizedTopic = topic.trim().toLowerCase()
    return commandHelp.find((entry) => {
      const commandName = (entry.syntax.split(' ')[0] ?? '').toLowerCase()
      if (commandName === normalizedTopic) {
        return true
      } // end if topic matches primary command name
      return (entry.aliases ?? []).some((alias) => alias.toLowerCase() === normalizedTopic)
    })
  } // end function findCommandHelpEntry

  const findHelpNodeByTitle = (
    node: DeveloperConsoleHelpNode,
    query: string,
    path: number[] = []
  ): { path: number[]; node: DeveloperConsoleHelpNode } | null => {
    if (node.title.toLowerCase() === query.toLowerCase()) {
      return { path, node }
    } // end if node title matches query

    for (let index = 0; index < (node.children ?? []).length; index += 1) {
      const child = node.children?.[index]
      if (!child) {
        continue
      } // end if child missing
      const match = findHelpNodeByTitle(child, query, [...path, index])
      if (match) {
        return match
      } // end if child subtree matched
    } // end for each child

    return null
  } // end function findHelpNodeByTitle

  const getDirectHelpLines = (topic: string): string[] => {
    const normalizedTopic = topic.trim()
    const bindings = getConsoleBindings()
    const binding = bindings[normalizedTopic]
    if (binding) {
      return createHelpLeafForBinding(normalizedTopic, binding).lines ?? [`No help found for "${normalizedTopic}".`]
    } // end if topic matched binding path

    const command = findCommandHelpEntry(normalizedTopic)
    if (command) {
      return createHelpLeafForCommand(command).lines ?? [`No help found for "${normalizedTopic}".`]
    } // end if topic matched command

    const tree = buildHelpTree()
    const categoryMatch = findHelpNodeByTitle(tree, normalizedTopic)
    if (categoryMatch) {
      helpMenuSelectionPath = categoryMatch.path
      return formatHelpMenuLines(categoryMatch.path)
    } // end if topic matched help category or leaf title

    return [`No help found for "${normalizedTopic}".`]
  } // end function getDirectHelpLines

  const navigateHelpMenuSelection = (rawSelection: string): string[] | null => {
    if (helpMenuSelectionPath === null) {
      return null
    } // end if help menu is not active

    if (!/^\d+$/.test(rawSelection.trim())) {
      return null
    } // end if input is not a numeric selection

    const selection = Number(rawSelection.trim())
    if (!Number.isInteger(selection)) {
      return null
    } // end if selection is not an integer

    if (selection === 0) {
      helpMenuSelectionPath = helpMenuSelectionPath.length > 0 ? helpMenuSelectionPath.slice(0, -1) : []
      return formatHelpMenuLines(helpMenuSelectionPath)
    } // end if navigating back

    const currentNode = getHelpNodeBySelectionPath(helpMenuSelectionPath)
    const children = currentNode?.children ?? []
    const nextNode = children[selection - 1]
    if (!nextNode) {
      return [`Invalid help selection: ${selection}.`, ...formatHelpMenuLines(helpMenuSelectionPath)]
    } // end if user selected out-of-range option

    helpMenuSelectionPath = [...helpMenuSelectionPath, selection - 1]
    return formatHelpMenuLines(helpMenuSelectionPath)
  } // end function navigateHelpMenuSelection

  let devConsole: ReturnType<typeof createDeveloperConsole> | null = null

  const closeDeveloperConsole = async (resumeGameplay: boolean = consoleResumeOnClose): Promise<void> => {
    if (!isConsoleOpen) {
      return
    } // end if console already closed

    isConsoleOpen = false
    devConsole?.close()
    const shouldResume = resumeGameplay
    consoleResumeOnClose = false
    if (shouldResume) {
      await resumeGame()
      return
    } // end if gameplay should resume after closing console

    setPauseOverlayVisible(true)
    if (resumeButtonElement instanceof HTMLButtonElement) {
      resumeButtonElement.focus()
    } // end if pause menu should regain focus
  } // end function closeDeveloperConsole

  const openDeveloperConsole = async (): Promise<void> => {
    if (isConsoleOpen || isEditorModalOpen || isWeaponEditorOpen) {
      return
    } // end if another modal already owns input focus

    if (!isPaused) {
      consoleResumeOnClose = true
      await enterPausedState(false)
    } else {
      consoleResumeOnClose = false
      setPauseOverlayVisible(false)
    } // end if console opened from active gameplay or pause menu

    isConsoleOpen = true
  helpMenuSelectionPath = null
    devConsole?.open()
    devConsole?.setStatus(consoleResumeOnClose
      ? 'PAUSED FOR CONSOLE | ENTER: RUN | TAB: COMPLETE | ESC OR `: RESUME'
      : 'PAUSE MENU HELD | ENTER: RUN | TAB: COMPLETE | ESC OR `: RETURN')
  } // end function openDeveloperConsole

  const executeDeveloperCommand = async (commandLine: string): Promise<string[]> => {
    const helpSelectionLines = navigateHelpMenuSelection(commandLine)
    if (helpSelectionLines !== null) {
      return helpSelectionLines
    } // end if command line selected an active help menu item

    const tokens = tokenizeCommandLine(commandLine)
    if (tokens.length === 0) {
      return []
    } // end if no tokens produced

    const command = (tokens[0] ?? '').toLowerCase()
    const args = tokens.slice(1)
    const bindings = getConsoleBindings()

    if (command === 'help') {
      if (args.length === 0) {
        helpMenuSelectionPath = []
        return formatHelpMenuLines([])
      } // end if opening top-level help menu

      const directTopic = args.join(' ')
      return getDirectHelpLines(directTopic)
    } // end if help command

    helpMenuSelectionPath = null

    if (command === 'state' || command === 'status') {
      return getStateLines()
    } // end if status command

    if (command === 'list' || command === 'paths') {
      const prefix = args[0] ?? ''
      const paths = getSortedBindingPaths(prefix)
      if (paths.length === 0) {
        return [`No editable paths match "${prefix}".`]
      } // end if no paths match prefix
      return ['Editable paths:', ...paths.map((path) => `  ${path}`)]
    } // end if list command

    if (command === 'get') {
      const path = args[0]
      if (!path) {
        throw new Error('Usage: get <path>')
      } // end if missing path
      const binding = bindings[path]
      if (!binding) {
        throw new Error(`Unknown path: ${path}`)
      } // end if binding missing
      return [`${path} = ${formatConsoleValue(binding.get())}`]
    } // end if get command

    if (command === 'set') {
      const path = args[0]
      const rawValue = args.slice(1).join(' ')
      if (!path || rawValue.length === 0) {
        throw new Error('Usage: set <path> <value>')
      } // end if command is missing path or value
      const binding = bindings[path]
      if (!binding || !binding.set) {
        throw new Error(`Path is not writable: ${path}`)
      } // end if binding is not writable
      const nextValue = await binding.set(rawValue)
      return [`${path} = ${formatConsoleValue(nextValue)}`]
    } // end if set command

    if (command === 'toggle') {
      const path = args[0]
      if (!path) {
        throw new Error('Usage: toggle <path>')
      } // end if toggle path missing
      const binding = bindings[path]
      if (!binding || !binding.set) {
        throw new Error(`Path is not writable: ${path}`)
      } // end if binding is not toggleable
      const currentValue = binding.get()
      if (typeof currentValue !== 'boolean') {
        throw new Error(`Path is not boolean: ${path}`)
      } // end if binding value is not boolean
      const nextValue = await binding.set(currentValue ? 'false' : 'true')
      return [`${path} = ${formatConsoleValue(nextValue)}`]
    } // end if toggle command

    if (command === 'spawn') {
      const enemyId = args[0] as EnemyId | undefined
      if (!enemyId || !enemyIds.includes(enemyId)) {
        throw new Error(`Usage: spawn <${enemyIds.join('|')}>`)
      } // end if enemy id missing or invalid
      const spawned = spawnRandomEnemy(combatWorld, collisionWorld, player, enemyId)
      return [spawned ? `${enemyId} spawned.` : `No valid spawn location for ${enemyId}.`]
    } // end if spawn command

    if (command === 'tp' || command === 'teleport') {
      if (args.length < 2) {
        throw new Error('Usage: tp <x> <y> [z]')
      } // end if teleport command is incomplete
      const x = parseFiniteNumber(args[0] ?? '', 'tp x')
      const y = parseFiniteNumber(args[1] ?? '', 'tp y')
      const z = args[2] !== undefined ? parseFiniteNumber(args[2], 'tp z') : (player.z ?? 0)
      return [placePlayer(x, y, z)]
    } // end if teleport command

    if (command === 'pause') {
      await enterPausedState(false)
      return ['Game paused.']
    } // end if pause command

    if (command === 'resume') {
      consoleResumeOnClose = true
      await closeDeveloperConsole(true)
      return []
    } // end if resume command

    if (command === 'close') {
      await closeDeveloperConsole(false)
      return []
    } // end if close command

    throw new Error(`Unknown command: ${command}`)
  } // end function executeDeveloperCommand

  const getDeveloperConsoleSuggestions = (commandLine: string): string[] => {
    const trimmedLine = commandLine.trimStart()
    const tokens = tokenizeCommandLine(trimmedLine)
    const hasTrailingWhitespace = /\s$/.test(commandLine)
    const commandNames = commandHelp.map((entry) => entry.syntax.split(' ')[0] ?? '').filter((name) => name.length > 0)

    if (helpMenuSelectionPath !== null && /^\d*$/.test(trimmedLine)) {
      const currentNode = getHelpNodeBySelectionPath(helpMenuSelectionPath)
      const children = currentNode?.children ?? []
      const suggestions = children.map((_, index) => String(index + 1))
      if (helpMenuSelectionPath.length > 0) {
        suggestions.unshift('0')
      } // end if back navigation is available
      return suggestions
    } // end if completing an active help-menu selection

    if (tokens.length === 0) {
      return commandNames
    } // end if no tokens entered yet

    const currentCommand = (tokens[0] ?? '').toLowerCase()
    if (tokens.length === 1 && !hasTrailingWhitespace) {
      return commandNames
        .filter((name) => name.startsWith(currentCommand))
        .map((name) => `${name} `)
    } // end if completing command name

    if (['get', 'set', 'toggle', 'help', 'list', 'paths'].includes(currentCommand)) {
      const currentPath = hasTrailingWhitespace ? '' : (tokens[tokens.length - 1] ?? '')
      const prefix = currentPath.toLowerCase()
      return getSortedBindingPaths()
        .filter((path) => path.toLowerCase().startsWith(prefix))
        .map((path) => `${currentCommand} ${path}${currentCommand === 'set' ? ' ' : ''}`)
    } // end if completing a bound path

    if (currentCommand === 'spawn') {
      const currentEnemy = hasTrailingWhitespace ? '' : ((tokens[1] ?? '').toLowerCase())
      return enemyIds
        .filter((enemyId) => enemyId.startsWith(currentEnemy))
        .map((enemyId) => `spawn ${enemyId}`)
    } // end if completing spawn target

    return []
  } // end function getDeveloperConsoleSuggestions

  if (
    devConsoleOverlayElement instanceof HTMLDivElement &&
    devConsoleOutputElement instanceof HTMLDivElement &&
    devConsoleInputElement instanceof HTMLInputElement &&
    devConsoleStatusElement instanceof HTMLDivElement
  ) {
    devConsole = createDeveloperConsole({
      elements: {
        overlay: devConsoleOverlayElement,
        output: devConsoleOutputElement,
        input: devConsoleInputElement,
        status: devConsoleStatusElement
      },
      executeCommand: executeDeveloperCommand,
      closeConsole: () => closeDeveloperConsole(),
      getSuggestions: getDeveloperConsoleSuggestions
    })
    devConsole.print([
      'MECH AUDIO DEV CONSOLE READY',
      'Type help for categorized command menus. Type list to browse editable paths.'
    ])
  } // end if developer console DOM is available

  window.mechDev = {
    help: () => [
      'window.mechDev.getState()',
      'window.mechDev.execute("set audio.enemies.volume 0.4")',
      'window.mechDev.setSharedFlightHeight(4)',
      'window.mechDev.setPlayerAltitude(1.5)',
      "window.mechDev.spawnEnemy('helicopter')",
      'window.mechDev.pause()',
      'window.mechDev.resume()'
    ],
    getState: () => ({
      sharedFlightHeight: getSharedFlightHeight(),
      player: {
        x: player.x,
        y: player.y,
        z: player.z ?? 0,
        flightState: player.flightState ?? 'grounded',
        isFlying: !!player.isFlying
      },
      weapon: { ...playerWeapon },
      paused: isPaused
    }),
    execute: async (commandLine: string) => executeDeveloperCommand(commandLine),
    setSharedFlightHeight: (value: number) => applySharedFlightHeight(value),
    setPlayerAltitude: (value: number) => setPlayerAltitude(value),
    spawnEnemy: (enemyId: EnemyId) => spawnRandomEnemy(combatWorld, collisionWorld, player, enemyId),
    pause: async () => {
      await pauseGame()
    },
    resume: async () => {
      await resumeGame()
    }
  }

  const gameLoop = (timestampMs: number): void => {
    const deltaSeconds = Math.min((timestampMs - lastTimeMs) / 1000, 0.05)
    lastTimeMs = timestampMs

    if (isPaused) {
      requestAnimationFrame(gameLoop)
      return
    } // end if game paused

    playerFireCooldownSeconds = Math.max(0, playerFireCooldownSeconds - deltaSeconds)

    if (input.selectedWeaponSlot !== null) {
      const selectedIndex = input.selectedWeaponSlot - 1
      input.selectedWeaponSlot = null
      if (selectedIndex !== activeWeaponIndex && selectedIndex >= 0 && selectedIndex < weaponLoadout.length) {
        equipWeaponAtIndex(selectedIndex)
      } // end if selected weapon changed
    } // end if selected weapon slot pending

    if (input.cycleWeaponPending) {
      input.cycleWeaponPending = false
      const nextIndex = (activeWeaponIndex + 1) % weaponLoadout.length
      equipWeaponAtIndex(nextIndex)
    } // end if weapon cycled

    updateFrame(
      {
        player,
        input,
        audio,
        state: updateState,
        flightAltitude: getSharedFlightHeight(),
        collisionWorld
      },
      deltaSeconds
    )

    const hpBeforeCombat = Math.max(0, player.hp)

    const energyRegenPerSecond = 1
    const energyDrainPerSecond = player.isFlying ? 2 : 0
    const epDelta = (energyRegenPerSecond - energyDrainPerSecond) * deltaSeconds
    player.ep = Math.max(0, Math.min(player.maxEp, player.ep + epDelta))

    if (input.speakHpPending) {
      input.speakHpPending = false
      speakPercent('Health', player.hp, player.maxHp)
    } // end if HP speech requested

    if (input.speakEpPending) {
      input.speakEpPending = false
      speakPercent('Energy', player.ep, player.maxEp)
    } // end if EP speech requested

    if (input.refillEpPending) {
      input.refillEpPending = false
      player.ep = player.maxEp
      if (awarenessStatusElement) {
        awarenessStatusElement.textContent = 'AWARENESS: EP RESTORED TO MAX'
      } // end if awareness status element exists
    } // end if EP refill requested

    if (input.refillHpPending) {
      input.refillHpPending = false
      player.hp = player.maxHp
      if (awarenessStatusElement) {
        awarenessStatusElement.textContent = 'AWARENESS: HP RESTORED TO MAX'
      } // end if awareness status element exists
    } // end if HP refill requested

    const pendingManualPing = input.sonarPingPending
    input.sonarPingPending = false
    const shouldTriggerManualPing = pendingManualPing && !player.isFlying

    if (input.spawnTankPending) {
      input.spawnTankPending = false
      const spawned = spawnRandomEnemy(combatWorld, collisionWorld, player, 'tank')
      if (awarenessStatusElement) {
        awarenessStatusElement.textContent = spawned
          ? 'AWARENESS: TANK SPAWNED'
          : 'AWARENESS: NO VALID SPAWN LOCATION'
      } // end if awareness status element exists
    } // end if spawn tank pending

    if (input.spawnStrikerPending) {
      input.spawnStrikerPending = false
      const spawned = spawnRandomEnemy(combatWorld, collisionWorld, player, 'striker')
      if (awarenessStatusElement) {
        awarenessStatusElement.textContent = spawned
          ? 'AWARENESS: STRIKER SPAWNED'
          : 'AWARENESS: NO VALID SPAWN LOCATION'
      } // end if awareness status element exists
    } // end if spawn striker pending

    if (input.spawnBrutePending) {
      input.spawnBrutePending = false
      const spawned = spawnRandomEnemy(combatWorld, collisionWorld, player, 'brute')
      if (awarenessStatusElement) {
        awarenessStatusElement.textContent = spawned
          ? 'AWARENESS: BRUTE SPAWNED'
          : 'AWARENESS: NO VALID SPAWN LOCATION'
      } // end if awareness status element exists
    } // end if spawn brute pending

    if (input.spawnHelicopterPending) {
      input.spawnHelicopterPending = false
      const spawned = spawnRandomEnemy(combatWorld, collisionWorld, player, 'helicopter')
      if (awarenessStatusElement) {
        awarenessStatusElement.textContent = spawned
          ? 'AWARENESS: HELICOPTER SPAWNED'
          : 'AWARENESS: NO VALID SPAWN LOCATION'
      } // end if awareness status element exists
    } // end if spawn helicopter pending

    stepCombatEcsWorld(combatWorld, collisionWorld, audio, player, deltaSeconds)
    if (player.hp < hpBeforeCombat) {
      audio.playPlayerHealthStatusTone(player.hp / Math.max(1, player.maxHp))
    } // end if player took damage this frame

    audio.updatePlayerHealthStatusAudio(deltaSeconds, player.hp / Math.max(1, player.maxHp))

    audio.updatePlayerEnergyStatusAudio(deltaSeconds, player.ep / Math.max(1, player.maxEp))

    const combatRender = getCombatRenderState(combatWorld)

    // --- Target lock evaluation ---
    const lockUpdate = updateTargetLock(
      targetLockState,
      player,
      combatRender.tanks,
      collisionWorld,
      playerWeapon.lockOnRange,
      playerWeapon.lockOnWindowWidthPercent,
      playerWeapon.lockOnWindowHeightPercent
    )

    if (lockUpdate.justLost || lockUpdate.switchedTarget) {
      audio.playLockLostChirp()
    } // end if lock lost or switched

    if (lockUpdate.justLocked || lockUpdate.switchedTarget) {
      audio.playLockOnChirp()
    } // end if lock acquired

    if (playerWeapon.weaponType === 'missile') {
      const currentLockId = lockUpdate.lockedTank?.id ?? null
      if (currentLockId === null) {
        if (missileLockProgressMs > 0 || missileLockConfirmed) {
          audio.playLockLostChirp()
        } // end if missile lock progress existed before loss
        missileLockProgressMs = 0
        missileLockTargetId = null
        missileLockConfirmed = false
        missileLockToneTimerSeconds = 0
      } else {
        if (missileLockTargetId !== currentLockId) {
          missileLockProgressMs = 0
          missileLockConfirmed = false
          missileLockToneTimerSeconds = 0
          missileLockTargetId = currentLockId
        } // end if lock target changed

        if (!missileLockConfirmed) {
          missileLockProgressMs += deltaSeconds * 1000
          missileLockToneTimerSeconds += deltaSeconds
          if (missileLockToneTimerSeconds >= 0.14) {
            audio.playMissileLockTone()
            missileLockToneTimerSeconds = 0
          } // end if another lock-acquiring tone is due

          if (missileLockProgressMs >= Math.max(0, playerWeapon.lockOnTimeMs)) {
            missileLockConfirmed = true
            audio.playMissileLockConfirmTone()
          } // end if lock-on timer completed
        } // end if missile lock not yet confirmed
      } // end if missile lock candidate exists
    } else {
      missileLockProgressMs = 0
      missileLockTargetId = null
      missileLockConfirmed = false
      missileLockToneTimerSeconds = 0
    } // end if missile-weapon lock processing

    const shouldAttemptShot = playerWeapon.isFullAuto ? input.fireHeld : input.firePending
    if (input.firePending) {
      input.firePending = false
    } // end if consume edge-trigger press

    if (shouldAttemptShot && playerFireCooldownSeconds <= 0) {
      const playerSpeed = Math.hypot(player.x - previousPlayerX, player.y - previousPlayerY) / Math.max(deltaSeconds, 0.0001)
      const maxMoveSpeed = player.isFlying ? PLAYER_FLIGHT_SPEED : PLAYER_SPEED
      const speedFraction = Math.min(1, playerSpeed / maxMoveSpeed)

      if (playerWeapon.weaponType === 'missile') {
        if (!missileLockConfirmed || lockUpdate.lockedTank === null) {
          audio.playNegativeActionTone()
        } else {
          audio.fireGunshot(playerWeapon.fireSoundPath)
          updateState.muzzleFlashTimer = MUZZLE_FLASH_DURATION
          if (playerWeapon.fireRateCooldownSeconds > 0) {
            playerFireCooldownSeconds = playerWeapon.fireRateCooldownSeconds
          } // end if fire rate applies

          const missilesPerShot = Math.max(1, Math.round(playerWeapon.projectileCount))
          for (let missileIndex = 0; missileIndex < missilesPerShot; missileIndex += 1) {
            spawnPlayerMissile(
              combatWorld,
              player,
              lockUpdate.lockedTank.id,
              playerWeapon.damagePerShot,
              playerWeapon.bulletSpeed,
              playerWeapon.maxRange,
              playerWeapon.projectileSize,
              playerWeapon.trackingRating,
              playerWeapon.explosionRadius,
              playerWeapon.explosionDamage,
              playerWeapon.explosionSounds
            )
          } // end for each missile in shot
        } // end if missile shot blocked or fired
      } else {
        audio.fireGunshot(playerWeapon.fireSoundPath)
        updateState.muzzleFlashTimer = MUZZLE_FLASH_DURATION
        if (playerWeapon.fireRateCooldownSeconds > 0) {
          playerFireCooldownSeconds = playerWeapon.fireRateCooldownSeconds
        } // end if fire rate applies
        if (lockUpdate.lockedTank !== null) {
          spawnPlayerBulletToward(
            combatWorld,
            player,
            lockUpdate.lockedTank.x,
            lockUpdate.lockedTank.y,
            lockUpdate.lockedTank.height + 0.5,
            playerWeapon.accuracy,
            speedFraction,
            playerWeapon.damagePerShot,
            playerWeapon.bulletSpeed,
            playerWeapon.maxRange,
            playerWeapon.projectileSize,
            playerWeapon.projectileCount,
            playerWeapon.spreadDegrees
          )
        } else {
          spawnPlayerBullet(
            combatWorld,
            player,
            playerWeapon.damagePerShot,
            playerWeapon.bulletSpeed,
            playerWeapon.maxRange,
            playerWeapon.projectileSize,
            playerWeapon.accuracy,
            speedFraction,
            playerWeapon.projectileCount,
            playerWeapon.spreadDegrees
          )
        } // end if locked target for accuracy cone
      } // end if missile or ballistic firing mode
    } // end if fire input and cooldown allow

    const awareness = computeObstructionAwareness(player, combatRender.tanks, collisionWorld, sprites)

    const playerAudioState = {
      position: { x: player.x, y: player.y, z: player.z ?? 0 },
      angle: player.angle,
      velocity: {
        x: (player.x - previousPlayerX) / Math.max(deltaSeconds, 0.0001),
        y: (player.y - previousPlayerY) / Math.max(deltaSeconds, 0.0001),
        z: ((player.z ?? 0) - previousPlayerZ) / Math.max(deltaSeconds, 0.0001)
      },
      isFlying: !!player.isFlying
    }
    const enemyAudioStates = combatRender.tanks.map((tank) => ({
      id: `tank-${tank.id}`,
      type: tank.enemyType,
      category: tank.airborne ? 'air' : 'ground',
      position: { x: tank.x, y: tank.y, z: tank.height },
      radius: tank.radius,
      velocity: { x: tank.velocityX, y: tank.velocityY, z: 0 },
      facingAngle: tank.angle,
      isMoving: Math.hypot(tank.velocityX, tank.velocityY) > 0.05,
      isAlive: tank.alive,
      height: tank.height
    }))

    if (shouldTriggerManualPing) {
      audio.triggerActiveSonar(playerAudioState, enemyAudioStates, collisionWorld, sprites)
    } // end if manual sonar ping was requested

    audio.updateFrameAudio(
      deltaSeconds,
      playerAudioState,
      enemyAudioStates,
      collisionWorld,
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
          ? (shouldTriggerManualPing
              ? 'SONAR: PASSIVE SWEEP ACTIVE | MANUAL PING FIRED'
              : 'SONAR: FLIGHT MODE | MANUAL PING DISABLED')
          : player.isFlying
            ? 'SONAR: FLIGHT MODE | MANUAL PING DISABLED'
            : 'SONAR: PASSIVE SWEEP ACTIVE | E: MANUAL PING'
      } // end if context running and timer active
    } // end if sonar status element exists

    if (playerStatusElement) {
      const hpPercent = Math.max(0, Math.min(100, Math.round((player.hp / Math.max(1, player.maxHp)) * 100)))
      const epPercent = Math.max(0, Math.min(100, Math.round((player.ep / Math.max(1, player.maxEp)) * 100)))
      playerStatusElement.textContent = `STATUS: HP ${hpPercent}% | EP ${epPercent}% | H: SPEAK HP | G: SPEAK EP`
    } // end if player status element exists

    previousPlayerX = player.x
    previousPlayerY = player.y
    previousPlayerZ = player.z ?? 0

    const muzzleFlashAlpha = updateState.muzzleFlashTimer / MUZZLE_FLASH_DURATION

    threeRenderer.renderFrame({
      enemies: combatRender.enemies,
      tanks: combatRender.tanks,
      bullets: combatRender.bullets,
      player,
      muzzleFlashAlpha,
      lockedTankId: targetLockState.lockedTankId,
      lockOnWindowWidthPercent: playerWeapon.lockOnWindowWidthPercent,
      lockOnWindowHeightPercent: playerWeapon.lockOnWindowHeightPercent
    })

    requestAnimationFrame(gameLoop)
  } // end function gameLoop

  requestAnimationFrame((timestampMs) => {
    lastTimeMs = timestampMs
    requestAnimationFrame(gameLoop)
  }) // end initial animation frame
} // end function startTestMap

startTestMap()
