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
  WEAPON_DEFAULT_ACCURACY,
  WEAPON_LOCK_ON_RANGE,
  BULLET_SPEED,
  BULLET_MAX_DIST
} from './constants.js'
import { createAudioController } from './audio.js'
import {
  createCombatEcsWorld,
  getCombatRenderState,
  spawnRandomEnemy,
  spawnRandomTankFromConfig,
  spawnPlayerBullet,
  spawnPlayerBulletToward,
  syncDynamicFlightHeights,
  stepCombatEcsWorld
} from './combat-ecs.js'
import { createTargetLockState, updateTargetLock } from './target-lock.js'
import { getEnemyDefinition } from './enemies/index.js'
import type { EnemyDefinitionConfig, EnemyMovementPattern } from './enemies/enemyTypes.js'
import type { EnemyId } from './enemies/enemyTypes.js'
import { getSharedFlightHeight, setSharedFlightHeight } from './runtime-config.js'
import type { WeaponStats } from './types.js'
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
  get: () => unknown
  set?: (rawValue: string) => unknown
} // end interface DeveloperConsoleBinding

interface DeveloperConsoleCommandHelp {
  syntax: string
  description: string
} // end interface DeveloperConsoleCommandHelp

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
  const weaponBulletSpeedInput = getInput('weaponBulletSpeed')
  const weaponMaxRangeInput = getInput('weaponMaxRange')
  const weaponFireRateInput = getInput('weaponFireRate')
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

  const playerWeapon: WeaponStats = {
    accuracy: WEAPON_DEFAULT_ACCURACY,
    lockOnRange: WEAPON_LOCK_ON_RANGE,
    damagePerShot: 10,
    bulletSpeed: BULLET_SPEED,
    maxRange: BULLET_MAX_DIST,
    fireRateCooldownSeconds: 0,
    lockOnWindowWidthPercent: 100,
    lockOnWindowHeightPercent: 100
  } // end object playerWeapon

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
    input.flightTogglePending = false
    input.sonarPingPending = false
    input.snapNorthPending = false
    input.snapEastPending = false
    input.snapSouthPending = false
    input.snapWestPending = false
    input.spawnTankPending = false
    input.spawnStrikerPending = false
    input.spawnBrutePending = false
    input.spawnHelicopterPending = false
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
    if (weaponBulletSpeedInput) weaponBulletSpeedInput.value = String(stats.bulletSpeed)
    if (weaponMaxRangeInput) weaponMaxRangeInput.value = String(stats.maxRange)
    if (weaponFireRateInput) weaponFireRateInput.value = String(stats.fireRateCooldownSeconds)
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
      accuracy: Math.max(0.01, Math.min(1, parseNum(weaponAccuracyInput, playerWeapon.accuracy))),
      damagePerShot: Math.max(1, Math.round(parseNum(weaponDamageInput, playerWeapon.damagePerShot))),
      bulletSpeed: Math.max(1, parseNum(weaponBulletSpeedInput, playerWeapon.bulletSpeed)),
      maxRange: Math.max(1, parseNum(weaponMaxRangeInput, playerWeapon.maxRange)),
      fireRateCooldownSeconds: Math.max(0, parseNum(weaponFireRateInput, playerWeapon.fireRateCooldownSeconds)),
      lockOnRange: Math.max(1, parseNum(weaponLockOnRangeInput, playerWeapon.lockOnRange)),
      lockOnWindowWidthPercent: Math.max(0, Math.min(100, Math.round(parseNum(weaponLockOnWindowWidthInput, playerWeapon.lockOnWindowWidthPercent)))),
      lockOnWindowHeightPercent: Math.max(0, Math.min(100, Math.round(parseNum(weaponLockOnWindowHeightInput, playerWeapon.lockOnWindowHeightPercent))))
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
    `weapon = accuracy:${playerWeapon.accuracy.toFixed(2)} damage:${playerWeapon.damagePerShot} speed:${playerWeapon.bulletSpeed.toFixed(2)} range:${playerWeapon.maxRange.toFixed(2)} fireRate:${playerWeapon.fireRateCooldownSeconds.toFixed(2)}`,
    `audio volumes = master:${audio.getVolumeChannel('master').toFixed(2)} ambience:${audio.getVolumeChannel('ambience').toFixed(2)} footsteps:${audio.getVolumeChannel('footsteps').toFixed(2)} servo:${audio.getVolumeChannel('servo').toFixed(2)}`,
    `audio categories = proximity:${audio.getCategoryEnabled('proximity')}@${audio.getVolumeChannel('proximity').toFixed(2)} objects:${audio.getCategoryEnabled('objects')}@${audio.getVolumeChannel('objects').toFixed(2)} enemies:${audio.getCategoryEnabled('enemies')}@${audio.getVolumeChannel('enemies').toFixed(2)} navigation:${audio.getCategoryEnabled('navigation')}@${audio.getVolumeChannel('navigation').toFixed(2)}`
  ]

  const getConsoleBindings = (): Record<string, DeveloperConsoleBinding> => ({
    'player.x': {
      description: 'Player world X position.',
      get: () => player.x,
      set: (rawValue) => {
        placePlayer(parseFiniteNumber(rawValue, 'player.x'), player.y, player.z ?? 0)
        return player.x
      }
    },
    'player.y': {
      description: 'Player world Y position.',
      get: () => player.y,
      set: (rawValue) => {
        placePlayer(player.x, parseFiniteNumber(rawValue, 'player.y'), player.z ?? 0)
        return player.y
      }
    },
    'player.z': {
      description: 'Player altitude above ground.',
      get: () => player.z ?? 0,
      set: (rawValue) => {
        placePlayer(player.x, player.y, parseFiniteNumber(rawValue, 'player.z'))
        return player.z ?? 0
      }
    },
    'player.angle': {
      description: 'Player facing angle in degrees.',
      get: () => (player.angle * 180) / Math.PI,
      set: (rawValue) => setPlayerAngleDegrees(parseFiniteNumber(rawValue, 'player.angle'))
    },
    'player.pitch': {
      description: 'Player look pitch in degrees.',
      get: () => (player.pitch * 180) / Math.PI,
      set: (rawValue) => setPlayerPitchDegrees(parseFiniteNumber(rawValue, 'player.pitch'))
    },
    'player.isFlying': {
      description: 'Whether the player is airborne.',
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
      get: () => player.flightState ?? 'grounded',
      set: (rawValue) => setPlayerFlightState(rawValue)
    },
    'flight.sharedHeight': {
      description: 'Shared airborne hover height used by the player and dynamic flight sync.',
      get: () => getSharedFlightHeight(),
      set: (rawValue) => applySharedFlightHeight(parseFiniteNumber(rawValue, 'flight.sharedHeight'))
    },
    'weapon.accuracy': {
      description: 'Player weapon accuracy from 0 to 1.',
      get: () => playerWeapon.accuracy,
      set: (rawValue) => {
        playerWeapon.accuracy = Math.max(0.01, Math.min(1, parseFiniteNumber(rawValue, 'weapon.accuracy')))
        return playerWeapon.accuracy
      }
    },
    'weapon.damagePerShot': {
      description: 'Player weapon damage per shot.',
      get: () => playerWeapon.damagePerShot,
      set: (rawValue) => {
        playerWeapon.damagePerShot = Math.max(1, Math.round(parseFiniteNumber(rawValue, 'weapon.damagePerShot')))
        return playerWeapon.damagePerShot
      }
    },
    'weapon.bulletSpeed': {
      description: 'Player weapon projectile speed.',
      get: () => playerWeapon.bulletSpeed,
      set: (rawValue) => {
        playerWeapon.bulletSpeed = Math.max(1, parseFiniteNumber(rawValue, 'weapon.bulletSpeed'))
        return playerWeapon.bulletSpeed
      }
    },
    'weapon.maxRange': {
      description: 'Player weapon maximum range.',
      get: () => playerWeapon.maxRange,
      set: (rawValue) => {
        playerWeapon.maxRange = Math.max(1, parseFiniteNumber(rawValue, 'weapon.maxRange'))
        return playerWeapon.maxRange
      }
    },
    'weapon.fireRateCooldownSeconds': {
      description: 'Seconds between player shots.',
      get: () => playerWeapon.fireRateCooldownSeconds,
      set: (rawValue) => {
        playerWeapon.fireRateCooldownSeconds = Math.max(0, parseFiniteNumber(rawValue, 'weapon.fireRateCooldownSeconds'))
        return playerWeapon.fireRateCooldownSeconds
      }
    },
    'weapon.lockOnRange': {
      description: 'Target-lock acquisition range.',
      get: () => playerWeapon.lockOnRange,
      set: (rawValue) => {
        playerWeapon.lockOnRange = Math.max(1, parseFiniteNumber(rawValue, 'weapon.lockOnRange'))
        return playerWeapon.lockOnRange
      }
    },
    'weapon.lockOnWindowWidthPercent': {
      description: 'Horizontal lock window percentage.',
      get: () => playerWeapon.lockOnWindowWidthPercent,
      set: (rawValue) => {
        playerWeapon.lockOnWindowWidthPercent = Math.max(0, Math.min(100, Math.round(parseFiniteNumber(rawValue, 'weapon.lockOnWindowWidthPercent'))))
        return playerWeapon.lockOnWindowWidthPercent
      }
    },
    'weapon.lockOnWindowHeightPercent': {
      description: 'Vertical lock window percentage.',
      get: () => playerWeapon.lockOnWindowHeightPercent,
      set: (rawValue) => {
        playerWeapon.lockOnWindowHeightPercent = Math.max(0, Math.min(100, Math.round(parseFiniteNumber(rawValue, 'weapon.lockOnWindowHeightPercent'))))
        return playerWeapon.lockOnWindowHeightPercent
      }
    },
    'aimAssist.enabled': {
      description: 'Aim assist enabled flag.',
      get: () => audio.isAimAssistEnabled(),
      set: (rawValue) => {
        const enabled = parseBooleanValue(rawValue)
        audio.setAimAssistEnabled(enabled)
        return audio.isAimAssistEnabled()
      }
    },
    'audio.master.volume': {
      description: 'Master volume scalar from 0 to 2.',
      get: () => audio.getVolumeChannel('master'),
      set: (rawValue) => audio.setVolumeChannel('master', parseFiniteNumber(rawValue, 'audio.master.volume'))
    },
    'audio.ambience.volume': {
      description: 'Ambience volume scalar from 0 to 2.',
      get: () => audio.getVolumeChannel('ambience'),
      set: (rawValue) => audio.setVolumeChannel('ambience', parseFiniteNumber(rawValue, 'audio.ambience.volume'))
    },
    'audio.footsteps.volume': {
      description: 'Footstep volume scalar from 0 to 2.',
      get: () => audio.getVolumeChannel('footsteps'),
      set: (rawValue) => audio.setVolumeChannel('footsteps', parseFiniteNumber(rawValue, 'audio.footsteps.volume'))
    },
    'audio.servo.volume': {
      description: 'Servo motor volume scalar from 0 to 2.',
      get: () => audio.getVolumeChannel('servo'),
      set: (rawValue) => audio.setVolumeChannel('servo', parseFiniteNumber(rawValue, 'audio.servo.volume'))
    },
    'audio.flightLoop.volume': {
      description: 'Player flight loop volume scalar from 0 to 2.',
      get: () => audio.getVolumeChannel('flightLoop'),
      set: (rawValue) => audio.setVolumeChannel('flightLoop', parseFiniteNumber(rawValue, 'audio.flightLoop.volume'))
    },
    'audio.proximity.enabled': {
      description: 'Enable or disable the proximity audio category.',
      get: () => audio.getCategoryEnabled('proximity'),
      set: (rawValue) => audio.setCategoryEnabled('proximity', parseBooleanValue(rawValue))
    },
    'audio.objects.enabled': {
      description: 'Enable or disable the objects audio category.',
      get: () => audio.getCategoryEnabled('objects'),
      set: (rawValue) => audio.setCategoryEnabled('objects', parseBooleanValue(rawValue))
    },
    'audio.enemies.enabled': {
      description: 'Enable or disable the enemies audio category.',
      get: () => audio.getCategoryEnabled('enemies'),
      set: (rawValue) => audio.setCategoryEnabled('enemies', parseBooleanValue(rawValue))
    },
    'audio.navigation.enabled': {
      description: 'Enable or disable the navigation audio category.',
      get: () => audio.getCategoryEnabled('navigation'),
      set: (rawValue) => audio.setCategoryEnabled('navigation', parseBooleanValue(rawValue))
    },
    'audio.proximity.volume': {
      description: 'Proximity audio volume scalar from 0 to 2.',
      get: () => audio.getVolumeChannel('proximity'),
      set: (rawValue) => audio.setVolumeChannel('proximity', parseFiniteNumber(rawValue, 'audio.proximity.volume'))
    },
    'audio.objects.volume': {
      description: 'Objects audio volume scalar from 0 to 2.',
      get: () => audio.getVolumeChannel('objects'),
      set: (rawValue) => audio.setVolumeChannel('objects', parseFiniteNumber(rawValue, 'audio.objects.volume'))
    },
    'audio.enemies.volume': {
      description: 'Enemies audio volume scalar from 0 to 2.',
      get: () => audio.getVolumeChannel('enemies'),
      set: (rawValue) => audio.setVolumeChannel('enemies', parseFiniteNumber(rawValue, 'audio.enemies.volume'))
    },
    'audio.navigation.volume': {
      description: 'Navigation audio volume scalar from 0 to 2.',
      get: () => audio.getVolumeChannel('navigation'),
      set: (rawValue) => audio.setVolumeChannel('navigation', parseFiniteNumber(rawValue, 'audio.navigation.volume'))
    }
  })

  const commandHelp: DeveloperConsoleCommandHelp[] = [
    { syntax: 'help [topic]', description: 'Show command help or describe a specific path.' },
    { syntax: 'state', description: 'Print a high-level snapshot of gameplay, weapon, and audio state.' },
    { syntax: 'list [prefix]', description: 'List every editable path, optionally filtered by prefix.' },
    { syntax: 'get <path>', description: 'Read the current value of a bound property.' },
    { syntax: 'set <path> <value>', description: 'Set a bound property to a numeric, boolean, or string value.' },
    { syntax: 'toggle <path>', description: 'Invert a boolean path such as audio.enemies.enabled.' },
    { syntax: 'spawn <enemyId>', description: 'Spawn an enemy: tank, striker, brute, or helicopter.' },
    { syntax: 'tp <x> <y> [z]', description: 'Teleport the player to a validated world position.' },
    { syntax: 'pause', description: 'Pause the game and keep the console open.' },
    { syntax: 'resume', description: 'Resume gameplay and close the console.' },
    { syntax: 'close', description: 'Close the console and return to the previous pause state.' },
    { syntax: 'clear', description: 'Clear the console output buffer.' }
  ]

  const getSortedBindingPaths = (prefix = ''): string[] => Object.keys(getConsoleBindings())
    .filter((path) => path.startsWith(prefix))
    .sort((left, right) => left.localeCompare(right))

  const getHelpLines = (topic?: string): string[] => {
    if (!topic) {
      return [
        'Available commands:',
        ...commandHelp.map((entry) => `  ${entry.syntax} - ${entry.description}`),
        'Examples:',
        '  set flight.sharedHeight 5',
        '  set player.angle 270',
        '  set audio.enemies.volume 0.35',
        '  toggle audio.navigation.enabled',
        '  tp 18 20 0'
      ]
    } // end if listing all commands

    const binding = getConsoleBindings()[topic]
    if (binding) {
      return [
        `${topic}`,
        `  ${binding.description}`,
        `  current = ${formatConsoleValue(binding.get())}`,
        `  writable = ${binding.set ? 'true' : 'false'}`
      ]
    } // end if topic is a binding path

    const command = commandHelp.find((entry) => entry.syntax.split(' ')[0] === topic)
    if (command) {
      return [`${command.syntax}`, `  ${command.description}`]
    } // end if topic is a command

    return [`No help found for "${topic}".`]
  } // end function getHelpLines

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
    devConsole?.open()
    devConsole?.setStatus(consoleResumeOnClose
      ? 'PAUSED FOR CONSOLE | ENTER: RUN | TAB: COMPLETE | ESC OR `: RESUME'
      : 'PAUSE MENU HELD | ENTER: RUN | TAB: COMPLETE | ESC OR `: RETURN')
  } // end function openDeveloperConsole

  const executeDeveloperCommand = async (commandLine: string): Promise<string[]> => {
    const tokens = tokenizeCommandLine(commandLine)
    if (tokens.length === 0) {
      return []
    } // end if no tokens produced

    const command = (tokens[0] ?? '').toLowerCase()
    const args = tokens.slice(1)
    const bindings = getConsoleBindings()

    if (command === 'help') {
      return getHelpLines(args[0])
    } // end if help command

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
      'Type help for commands. Type list to browse editable paths.'
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

    if (input.firePending) {
      input.firePending = false
      if (playerFireCooldownSeconds <= 0) {
        audio.fireGunshot()
        updateState.muzzleFlashTimer = MUZZLE_FLASH_DURATION
        if (playerWeapon.fireRateCooldownSeconds > 0) {
          playerFireCooldownSeconds = playerWeapon.fireRateCooldownSeconds
        } // end if fire rate applies
        if (lockUpdate.lockedTank !== null) {
          const playerSpeed = Math.hypot(player.x - previousPlayerX, player.y - previousPlayerY) / Math.max(deltaSeconds, 0.0001)
          const maxMoveSpeed = player.isFlying ? PLAYER_FLIGHT_SPEED : PLAYER_SPEED
          const speedFraction = Math.min(1, playerSpeed / maxMoveSpeed)
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
            playerWeapon.maxRange
          )
        } else {
          spawnPlayerBullet(combatWorld, player, playerWeapon.damagePerShot, playerWeapon.bulletSpeed, playerWeapon.maxRange)
        } // end if locked target for accuracy cone
      } // end if fire rate cooldown elapsed
    } // end if fire pending

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
