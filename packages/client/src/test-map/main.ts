import {
  BOOST_EP_DRAIN_PER_SECOND,
  CANVAS_HEIGHT_LIMIT,
  CANVAS_WIDTH_LIMIT,
  MAP_HEIGHT,
  MAP_WIDTH,
  MUZZLE_FLASH_DURATION,
  MAX_LOOK_PITCH,
  PLAYER_HEIGHT,
  PLAYER_FLIGHT_SPEED,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  TURN_SPEED,
  WEAPON_DEFAULT_ACCURACY
} from './constants.js'
import { createAudioController } from './audio.js'
import { AUDIO_NAVIGATION_CONFIG } from './audio-config.js'
import {
  clearCombatEntities,
  createCombatEcsWorld,
  getCombatEntityCounts,
  getCombatRenderState,
  performPlayerMeleeAttack,
  spawnEnemyCloseInFront,
  spawnEnemyConfigCloseInFront,
  spawnRandomEnemy,
  spawnRandomTankFromConfig,
  spawnEnemyAtPosition,
  spawnEnemyFromConfigAtPosition,
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
import { PLAYER_MELEE_WEAPON_DEFINITIONS, PLAYER_WEAPON_DEFINITIONS, type PlayerMeleeWeaponDefinition, type PlayerWeaponDefinition } from './weapons.js'
import { bindInput } from './input.js'
import { createDeveloperConsole } from './dev-console.js'
import { createMapData } from './map-data.js'
import { createInputState, createPlayer } from './player-state.js'
import { TEST_MAP_NAVIGATION_POIS } from './scene-layout.js'
import { createSprites } from './sprites.js'
import { createThreeRenderSystem } from './three-render.js'
import { createUpdateState, updateFrame } from './update.js'
import { createWorldCollisionWorld, isPlayerBlocked, PLAYER_COLLISION_HEIGHT } from './world-collision.js'
import type { AudioCategory, AudioVolumeChannel } from './types.js'
import type { WorldPosition } from './types.js'

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

type NavigationCategoryId = 'cities' | 'towns' | 'outposts' | 'other'

interface KnownPoi {
  id: string
  name: string
  category: NavigationCategoryId
  position: WorldPosition
} // end interface KnownPoi

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
  const EMPTY_CLIP_SOUND_PATH = 'assets/sounds/weapons/emptyClip.ogg'
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
  const awarenessWeaponNameElement = document.getElementById('awarenessWeaponName')
  const awarenessWeaponTypeElement = document.getElementById('awarenessWeaponType')
  const awarenessWeaponDamageElement = document.getElementById('awarenessWeaponDamage')
  const awarenessWeaponRateElement = document.getElementById('awarenessWeaponRate')
  const awarenessWeaponRangeElement = document.getElementById('awarenessWeaponRange')
  const awarenessWeaponProjectilesElement = document.getElementById('awarenessWeaponProjectiles')
  const awarenessWeaponSpreadElement = document.getElementById('awarenessWeaponSpread')
  const awarenessWeaponAccuracyElement = document.getElementById('awarenessWeaponAccuracy')
  const sonarCoordinatesElement = document.getElementById('sonarCoordinates')
  const sonarRadarRangeElement = document.getElementById('sonarRadarRange')
  const sonarDestinationElement = document.getElementById('sonarDestination')
  const runtimeDebugOverlayElement = document.getElementById('runtimeDebugOverlay')
  const runtimeDebugContentElement = document.getElementById('runtimeDebugContent')
  const runtimeDebugSpeechStatusElement = document.getElementById('runtimeDebugSpeechStatus')
  const hpBarLabelElement = document.getElementById('hpBarLabel')
  const epBarLabelElement = document.getElementById('epBarLabel')
  const ammoResourceLabelElement = document.getElementById('ammoResourceLabel')
  const hpBarFillElement = document.getElementById('hpBarFill')
  const epBarFillElement = document.getElementById('epBarFill')
  const playerNameElement = document.getElementById('playerName')
  const pauseOverlayElement = document.getElementById('pauseOverlay')
  const pauseDebugTabRuntimeButtonElement = document.getElementById('pauseDebugTabRuntimeButton')
  const pauseDebugTabEventsButtonElement = document.getElementById('pauseDebugTabEventsButton')
  const pauseDebugTabTuningButtonElement = document.getElementById('pauseDebugTabTuningButton')
  const pauseDebugRuntimePanelElement = document.getElementById('pauseDebugRuntimePanel')
  const pauseDebugEventsPanelElement = document.getElementById('pauseDebugEventsPanel')
  const pauseDebugTuningPanelElement = document.getElementById('pauseDebugTuningPanel')
  const pauseDebugRuntimeContentElement = document.getElementById('pauseDebugRuntimeContent')
  const pauseDebugEventsContentElement = document.getElementById('pauseDebugEventsContent')
  const pauseTuneHeatMultiplierInput = getInput('pauseTuneHeatMultiplier')
  const pauseTuneEnergyRegenInput = getInput('pauseTuneEnergyRegen')
  const pauseTuneCoolingRateInput = getInput('pauseTuneCoolingRate')
  const pauseTuneMovementScalingInput = getInput('pauseTuneMovementScaling')
  const pauseTuneStaggerScalingInput = getInput('pauseTuneStaggerScaling')
  const pauseTuneTractionMultiplierInput = getInput('pauseTuneTractionMultiplier')
  const pauseTuneDriftMultiplierInput = getInput('pauseTuneDriftMultiplier')
  const pauseTuneAudioPitchScalingInput = getInput('pauseTuneAudioPitchScaling')
  const pauseTuneAudioVolumeScalingInput = getInput('pauseTuneAudioVolumeScaling')
  const resumeButtonElement = document.getElementById('pauseResumeButton')
  const exitButtonElement = document.getElementById('pauseExitButton')
  const devConsoleOverlayElement = document.getElementById('devConsoleOverlay')
  const devConsoleOutputElement = document.getElementById('devConsoleOutput')
  const devConsoleInputElement = document.getElementById('devConsoleInput')
  const devConsoleStatusElement = document.getElementById('devConsoleStatus')
  const navigationOverlayElement = document.getElementById('navigationOverlay')
  const navClearButtonElement = document.getElementById('navClearButton')
  const navCloseButtonElement = document.getElementById('navCloseButton')
  const navCategoryCitiesButtonElement = document.getElementById('navCategoryCitiesButton')
  const navCategoryTownsButtonElement = document.getElementById('navCategoryTownsButton')
  const navCategoryOutpostsButtonElement = document.getElementById('navCategoryOutpostsButton')
  const navCategoryOtherButtonElement = document.getElementById('navCategoryOtherButton')
  const navCategoryCitiesListElement = document.getElementById('navCategoryCitiesList')
  const navCategoryTownsListElement = document.getElementById('navCategoryTownsList')
  const navCategoryOutpostsListElement = document.getElementById('navCategoryOutpostsList')
  const navCategoryOtherListElement = document.getElementById('navCategoryOtherList')

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
  const editorStationaryInput = getInput('editorStationary')
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
  const editorLoopSoundPauseIntervalInput = getInput('editorLoopSoundPauseIntervalMs')

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
  audio.prewarmEnemyAudioAssets()

  let isPaused = false
  let isConsoleOpen = false
  let isNavigationMenuOpen = false
  let consoleResumeOnClose = false
  let queuedEnemySpawn: EnemyDefinitionConfig | null = null
  let isEditorModalOpen = false
  let editorCurrentEnemyId: EnemyId = 'tank'
  let isWeaponEditorOpen = false
  let playerFireCooldownSeconds = 0
  let playerMeleeCooldownSeconds = 0
  let universalAmmoResource = 1200
  let isReloading = false
  let hasPlayedEmptyClipForCurrentTriggerPull = false

  const weaponLoadout: PlayerWeaponDefinition[] = PLAYER_WEAPON_DEFINITIONS.map((weapon) => ({
    ...weapon,
    explosionSounds: [...weapon.explosionSounds]
  }))
  const meleeLoadout: PlayerMeleeWeaponDefinition[] = PLAYER_MELEE_WEAPON_DEFINITIONS.map((weapon) => ({
    ...weapon,
    swingSoundPaths: [...weapon.swingSoundPaths]
  }))
  let activeWeaponIndex = 0
  let playerWeapon = weaponLoadout[activeWeaponIndex]!
  let equippedMeleeWeapon = meleeLoadout[0] ?? null
  let missileLockProgressMs = 0
  let missileLockTargetId: number | null = null
  let missileLockConfirmed = false
  let missileLockToneTimerSeconds = 0
  let destinationPoiId: string | null = null
  let devTimeScale = 1
  let devAiEnabled = true
  let devPhysicsDebugEnabled = false
  let devAudioDebugEnabled = false
  let devEventsDebugEnabled = false
  let devCurrentHeat = 0
  let devMaxHeat = 100
  let devLastDamageAmount = 0
  let devLastDamageType = 'none'
  let devLastEvent = 'none'
  let devEventCounter = 0
  const devEventLog: string[] = []
  const devTimers = new Map<string, number>()
  let devVelocityX = 0
  let devVelocityY = 0
  let devVelocityZ = 0
  let devPrevX = player.x
  let devPrevY = player.y
  let devPrevZ = player.z ?? 0
  let devLastHitLocation = 'none'
  let devLastHeatGain = 0
  let devLastEnergyDrain = 0
  let devFps = 0
  let devPreviousSpeed = 0
  let devApproxAcceleration = 0
  let devTargetLockedId: number | null = null
  let devEnemyCount = 0
  let devProjectileCount = 0
  let isRuntimeDebugOverlayVisible = false
  let pauseDebugActiveTab: 'runtime' | 'events' | 'tuning' = 'runtime'
  let devHeatMultiplier = 1
  let devEnergyRegenRate = 1
  let devCoolingRate = 0
  let devMovementScale = 1
  let devStaggerScale = 1
  let devTractionMultiplier = 1
  let devDriftMultiplier = 1
  let devAudioPitchScale = 1
  let devAudioVolumeScale = 1

  const DEV_PART_SLOTS = [
    'Head',
    'Computer',
    'ExoShell',
    'Arms',
    'Movement',
    'Generator',
    'ThermalRegulator',
    'ShoulderLeft',
    'ShoulderRight',
    'LeftHand',
    'RightHand',
    'FlightSystem'
  ] as const
  type DevPartSlot = typeof DEV_PART_SLOTS[number]
  type DevPartState = {
    partId: string
    name: string
    integrity: number
    maxIntegrity: number
    online: boolean
    weight: number
    PDEF: number
    EDEF: number
    energyDrain: number
  }
  const devParts = new Map<DevPartSlot, DevPartState>(DEV_PART_SLOTS.map((slot) => [
    slot,
    {
      partId: `placeholder.${slot}`,
      name: `${slot} Placeholder`,
      integrity: 100,
      maxIntegrity: 100,
      online: true,
      weight: 0,
      PDEF: 0,
      EDEF: 0,
      energyDrain: 0
    }
  ]))

  const knownPois: KnownPoi[] = TEST_MAP_NAVIGATION_POIS.map((poi) => ({
    id: poi.id,
    name: poi.name,
    category: poi.category,
    position: { x: poi.x, y: poi.y, z: 0 }
  }))
  const discoveredPoiIds = new Set<string>(knownPois.map((poi) => poi.id))
  const expandedNavigationCategories = new Set<NavigationCategoryId>(['cities', 'towns', 'outposts', 'other'])
  const navigationPoiButtons = new Map<string, HTMLButtonElement>()

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
    input.reloadPending = false
    input.meleePending = false
    input.flightTogglePending = false
    input.sonarPingPending = false
    input.snapNorthPending = false
    input.snapEastPending = false
    input.snapSouthPending = false
    input.snapWestPending = false
    input.snapLeftPending = false
    input.snapRightPending = false
    input.selectedWeaponSlot = null
    input.spawnTankPending = false
    input.spawnStrikerPending = false
    input.spawnBrutePending = false
    input.spawnHelicopterPending = false
    input.spawnBruiserPending = false
    input.spawnTestDummyPending = false
    input.refillEpPending = false
    input.refillHpPending = false
    input.speakHpPending = false
    input.speakEpPending = false
    input.speakCoordsPending = false
    input.speakDestinationPending = false
    hasPlayedEmptyClipForCurrentTriggerPull = false
  } // end function clearGameplayInputs

  const getWeaponReloadCost = (weapon: PlayerWeaponDefinition): number => {
    return Math.ceil(Math.max(0, weapon.clipSize) * Math.max(0, weapon.ammoResourcePerRound))
  } // end function getWeaponReloadCost

  const canAffordWeaponReload = (weapon: PlayerWeaponDefinition): boolean => {
    return universalAmmoResource >= getWeaponReloadCost(weapon)
  } // end function canAffordWeaponReload

  const tryStartWeaponReload = (): void => {
    if (isReloading) {
      return
    } // end if already reloading

    if (playerWeapon.ammoInClip >= playerWeapon.clipSize) {
      return
    } // end if clip already full

    const reloadCost = getWeaponReloadCost(playerWeapon)
    if (reloadCost <= 0 || !canAffordWeaponReload(playerWeapon)) {
      audio.playNegativeActionTone()
      return
    } // end if not enough universal ammo for reload

    isReloading = true
    const reloadWeapon = playerWeapon
    const reloadWeaponId = playerWeapon.id

    void audio.playWeaponReloadSequence(reloadWeapon.reloadDefinition)
      .catch(() => undefined)
      .finally(() => {
        if (playerWeapon.id === reloadWeaponId) {
          if (universalAmmoResource >= reloadCost) {
            universalAmmoResource -= reloadCost
            reloadWeapon.ammoInClip = reloadWeapon.clipSize
          } // end if ammo still sufficient after reload delay
        }
        isReloading = false
      })
  } // end function tryStartWeaponReload

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
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(playerWeapon.name)
      utterance.rate = 1
      utterance.pitch = 1
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    } // end if speech synthesis available

  } // end function equipWeaponAtIndex

  const setPauseOverlayVisible = (visible: boolean): void => {
    if (!(pauseOverlayElement instanceof HTMLDivElement)) {
      return
    } // end if pause overlay element missing

    pauseOverlayElement.style.display = visible ? 'flex' : 'none'
    pauseOverlayElement.setAttribute('aria-hidden', visible ? 'false' : 'true')
    if (visible) {
      updatePauseDebugTabs()
    } // end if pause overlay became visible
  } // end function setPauseOverlayVisible

  const setPauseDebugActiveTab = (nextTab: 'runtime' | 'events' | 'tuning'): void => {
    pauseDebugActiveTab = nextTab
    const buttonState = [
      { button: pauseDebugTabRuntimeButtonElement, selected: nextTab === 'runtime' },
      { button: pauseDebugTabEventsButtonElement, selected: nextTab === 'events' },
      { button: pauseDebugTabTuningButtonElement, selected: nextTab === 'tuning' }
    ]
    for (const entry of buttonState) {
      if (!(entry.button instanceof HTMLButtonElement)) {
        continue
      } // end if tab button is unavailable
      entry.button.setAttribute('aria-selected', entry.selected ? 'true' : 'false')
    } // end for each tab button

    const panelState = [
      { panel: pauseDebugRuntimePanelElement, active: nextTab === 'runtime' },
      { panel: pauseDebugEventsPanelElement, active: nextTab === 'events' },
      { panel: pauseDebugTuningPanelElement, active: nextTab === 'tuning' }
    ]
    for (const entry of panelState) {
      if (!(entry.panel instanceof HTMLElement)) {
        continue
      } // end if tab panel is unavailable
      entry.panel.classList.toggle('active', entry.active)
    } // end for each tab panel
  } // end function setPauseDebugActiveTab

  const applyDebugAudioVolumeScale = (): void => {
    const scaledMaster = Math.max(0, Math.min(2, devAudioVolumeScale))
    audio.setVolumeChannel('master', scaledMaster)
  } // end function applyDebugAudioVolumeScale

  const readTuningInput = (input: HTMLInputElement | null, fallback: number): number => {
    if (!input) {
      return fallback
    } // end if input is missing
    const parsed = Number(input.value)
    return Number.isFinite(parsed) ? parsed : fallback
  } // end function readTuningInput

  const applyPauseDebugTuningValues = (): void => {
    devHeatMultiplier = Math.max(0, readTuningInput(pauseTuneHeatMultiplierInput, devHeatMultiplier))
    devEnergyRegenRate = Math.max(0, readTuningInput(pauseTuneEnergyRegenInput, devEnergyRegenRate))
    devCoolingRate = Math.max(0, readTuningInput(pauseTuneCoolingRateInput, devCoolingRate))
    devMovementScale = Math.max(0, readTuningInput(pauseTuneMovementScalingInput, devMovementScale))
    devStaggerScale = Math.max(0, readTuningInput(pauseTuneStaggerScalingInput, devStaggerScale))
    devTractionMultiplier = Math.max(0.1, readTuningInput(pauseTuneTractionMultiplierInput, devTractionMultiplier))
    devDriftMultiplier = Math.max(0.1, readTuningInput(pauseTuneDriftMultiplierInput, devDriftMultiplier))
    devAudioPitchScale = Math.max(0.5, Math.min(2, readTuningInput(pauseTuneAudioPitchScalingInput, devAudioPitchScale)))
    devAudioVolumeScale = Math.max(0, Math.min(2, readTuningInput(pauseTuneAudioVolumeScalingInput, devAudioVolumeScale)))

    audio.setDebugPitchScale(devAudioPitchScale)
    applyDebugAudioVolumeScale()
  } // end function applyPauseDebugTuningValues

  const updatePauseDebugTabs = (): void => {
    if (!(pauseOverlayElement instanceof HTMLDivElement) || pauseOverlayElement.style.display === 'none') {
      return
    } // end if pause overlay is hidden

    if (pauseDebugRuntimeContentElement instanceof HTMLElement) {
      pauseDebugRuntimeContentElement.textContent = getRuntimeDebugOverlayLines().join('\n')
    } // end if runtime tab content exists

    if (pauseDebugEventsContentElement instanceof HTMLElement) {
      pauseDebugEventsContentElement.textContent = devEventLog.length > 0
        ? devEventLog.join('\n')
        : 'No events yet.'
    } // end if event tab content exists

    setPauseDebugActiveTab(pauseDebugActiveTab)
  } // end function updatePauseDebugTabs

  const getDestinationPoi = (): KnownPoi | null => {
    if (!destinationPoiId) {
      return null
    } // end if no destination selected
    return knownPois.find((poi) => poi.id === destinationPoiId) ?? null
  } // end function getDestinationPoi

  const updatePoiSelectionVisuals = (): void => {
    for (const [poiId, button] of navigationPoiButtons.entries()) {
      const selected = destinationPoiId === poiId
      button.setAttribute('aria-pressed', selected ? 'true' : 'false')
    } // end for each POI button
  } // end function updatePoiSelectionVisuals

  const updateNavigationOverlayVisibility = (visible: boolean): void => {
    if (!(navigationOverlayElement instanceof HTMLDivElement)) {
      return
    } // end if navigation overlay missing
    navigationOverlayElement.style.display = visible ? 'flex' : 'none'
    navigationOverlayElement.setAttribute('aria-hidden', visible ? 'false' : 'true')
  } // end function updateNavigationOverlayVisibility

  const setDestinationPoi = (poiId: string): void => {
    if (!discoveredPoiIds.has(poiId)) {
      return
    } // end if POI not yet discovered

    const poi = knownPois.find((candidate) => candidate.id === poiId)
    if (!poi) {
      return
    } // end if POI id not known

    destinationPoiId = poiId
    updatePoiSelectionVisuals()
  } // end function setDestinationPoi

  const clearDestinationPoi = (): void => {
    destinationPoiId = null
    updatePoiSelectionVisuals()
  } // end function clearDestinationPoi

  const speakCurrentDestinationStatus = (): void => {
    const destination = getDestinationPoi()
    if (!('speechSynthesis' in window)) {
      return
    } // end if speech synthesis unavailable

    let message = 'No destination selected'
    if (destination) {
      const distance = Math.hypot(destination.position.x - player.x, destination.position.y - player.y)
      message = `${destination.name}. ${Math.round(distance)} world units`
    } // end if destination exists

    const utterance = new SpeechSynthesisUtterance(message)
    utterance.rate = 1
    utterance.pitch = 1
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  } // end function speakCurrentDestinationStatus

  const setCategoryExpanded = (category: NavigationCategoryId, expanded: boolean): void => {
    if (expanded) {
      expandedNavigationCategories.add(category)
    } else {
      expandedNavigationCategories.delete(category)
    } // end if updating category expansion state

    const controls = {
      cities: {
        button: navCategoryCitiesButtonElement,
        list: navCategoryCitiesListElement
      },
      towns: {
        button: navCategoryTownsButtonElement,
        list: navCategoryTownsListElement
      },
      outposts: {
        button: navCategoryOutpostsButtonElement,
        list: navCategoryOutpostsListElement
      },
      other: {
        button: navCategoryOtherButtonElement,
        list: navCategoryOtherListElement
      }
    }

    const control = controls[category]
    if (control?.button instanceof HTMLButtonElement) {
      control.button.setAttribute('aria-expanded', expanded ? 'true' : 'false')
    } // end if category toggle button exists
    if (control?.list instanceof HTMLUListElement) {
      control.list.hidden = !expanded
      control.list.setAttribute('aria-hidden', expanded ? 'false' : 'true')

      const childButtons = control.list.querySelectorAll('button')
      childButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
          return
        } // end if non-button node
        button.tabIndex = expanded ? 0 : -1
      })
    } // end if category list exists
  } // end function setCategoryExpanded

  const buildCategoryList = (category: NavigationCategoryId, listElement: HTMLElement | null): void => {
    if (!(listElement instanceof HTMLUListElement)) {
      return
    } // end if category list element missing

    listElement.innerHTML = ''
    const pois = knownPois.filter((poi) => poi.category === category && discoveredPoiIds.has(poi.id))

    if (pois.length === 0) {
      const item = document.createElement('li')
      item.className = 'navigation-empty'
      item.textContent = 'No known locations'
      listElement.appendChild(item)
      return
    } // end if no discovered POIs in category

    for (const poi of pois) {
      const listItem = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'navigation-poi'
      button.textContent = poi.name
      button.setAttribute('data-poi-id', poi.id)
      button.setAttribute('aria-pressed', destinationPoiId === poi.id ? 'true' : 'false')
      button.addEventListener('click', () => {
        setDestinationPoi(poi.id)
      })
      listItem.appendChild(button)
      listElement.appendChild(listItem)
      navigationPoiButtons.set(poi.id, button)
    } // end for each POI in category
  } // end function buildCategoryList

  const renderNavigationPoiMenu = (): void => {
    navigationPoiButtons.clear()
    buildCategoryList('cities', navCategoryCitiesListElement)
    buildCategoryList('towns', navCategoryTownsListElement)
    buildCategoryList('outposts', navCategoryOutpostsListElement)
    buildCategoryList('other', navCategoryOtherListElement)
    updatePoiSelectionVisuals()
  } // end function renderNavigationPoiMenu

  const closeNavigationMenu = (): void => {
    isNavigationMenuOpen = false
    updateNavigationOverlayVisibility(false)
    clearGameplayInputs()
  } // end function closeNavigationMenu

  const openNavigationMenu = (): void => {
    if (isConsoleOpen || isEditorModalOpen || isWeaponEditorOpen || isPaused) {
      return
    } // end if another modal interface is open

    isNavigationMenuOpen = true
    renderNavigationPoiMenu()
    updateNavigationOverlayVisibility(true)
    clearGameplayInputs()
    if (navCategoryCitiesButtonElement instanceof HTMLButtonElement) {
      navCategoryCitiesButtonElement.focus()
    } // end if first category button exists
  } // end function openNavigationMenu

  const toggleNavigationMenu = (): void => {
    if (isNavigationMenuOpen) {
      closeNavigationMenu()
      return
    } // end if menu should close
    openNavigationMenu()
  } // end function toggleNavigationMenu

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
      explosionSounds: [...playerWeapon.explosionSounds],
      clipSize: playerWeapon.clipSize,
      ammoInClip: playerWeapon.ammoInClip,
      ammoResourcePerRound: playerWeapon.ammoResourcePerRound,
      reloadDefinition: {
        timeline: playerWeapon.reloadDefinition.timeline.map((segment) => ({ ...segment })),
        servoLoopSoundPath: playerWeapon.reloadDefinition.servoLoopSoundPath,
        servoEffects: playerWeapon.reloadDefinition.servoEffects.map((effect) => ({ ...effect }))
      }
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
    if (editorStationaryInput) editorStationaryInput.checked = config.behavior.stationary
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
    if (editorLoopSoundPauseIntervalInput) editorLoopSoundPauseIntervalInput.value = String(config.sounds.loopSoundPauseIntervalMs ?? 0)
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
        lineOfSightRequiredToShoot: editorLineOfSightInput?.checked ?? def.behavior.lineOfSightRequiredToShoot,
        stationary: editorStationaryInput?.checked ?? def.behavior.stationary
      },
      sounds: {
        attackSound: editorAttackSoundInput?.value.trim() || def.sounds.attackSound,
        hurtSound: editorHurtSoundInput?.value.trim() || def.sounds.hurtSound,
        deathSound: editorDeathSoundInput?.value.trim() || def.sounds.deathSound,
        positionalLoopSound: editorLoopSoundInput?.value.trim() || def.sounds.positionalLoopSound,
        loopSoundPauseIntervalMs: Math.max(0, Math.round(parseNum(editorLoopSoundPauseIntervalInput, def.sounds.loopSoundPauseIntervalMs ?? 0)))
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
    if (isNavigationMenuOpen) {
      closeNavigationMenu()
    } // end if navigation menu open while pausing

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
      if (pendingSpawnConfig.id === 'test-dummy') {
        spawnEnemyConfigCloseInFront(combatWorld, collisionWorld, player, pendingSpawnConfig)
      } else {
        spawnRandomTankFromConfig(combatWorld, collisionWorld, player, pendingSpawnConfig)
      } // end if queued spawn should use close or random placement
    } // end if pending custom enemy spawn
  } // end function resumeGame

  const togglePause = async (): Promise<void> => {
    if (isPaused) {
      await resumeGame()
      return
    } // end if resuming

    await pauseGame()
  } // end function togglePause

  bindInput(input, audio, () => isPaused || isWeaponEditorOpen || isConsoleOpen || isNavigationMenuOpen)

  const categoryToggleBindings: Array<[NavigationCategoryId, HTMLElement | null]> = [
    ['cities', navCategoryCitiesButtonElement],
    ['towns', navCategoryTownsButtonElement],
    ['outposts', navCategoryOutpostsButtonElement],
    ['other', navCategoryOtherButtonElement]
  ]
  for (const [category, toggleElement] of categoryToggleBindings) {
    if (!(toggleElement instanceof HTMLButtonElement)) {
      continue
    } // end if category toggle element missing

    setCategoryExpanded(category, expandedNavigationCategories.has(category))
    toggleElement.addEventListener('click', () => {
      const nextExpanded = !expandedNavigationCategories.has(category)
      setCategoryExpanded(category, nextExpanded)
    })
  } // end for each category toggle

  if (navClearButtonElement instanceof HTMLButtonElement) {
    navClearButtonElement.addEventListener('click', () => {
      clearDestinationPoi()
    })
  } // end if clear-destination button exists

  if (navCloseButtonElement instanceof HTMLButtonElement) {
    navCloseButtonElement.addEventListener('click', () => {
      closeNavigationMenu()
    })
  } // end if close button exists

  const pauseDebugTabButtons: Array<[HTMLButtonElement | null, 'runtime' | 'events' | 'tuning']> = [
    [pauseDebugTabRuntimeButtonElement instanceof HTMLButtonElement ? pauseDebugTabRuntimeButtonElement : null, 'runtime'],
    [pauseDebugTabEventsButtonElement instanceof HTMLButtonElement ? pauseDebugTabEventsButtonElement : null, 'events'],
    [pauseDebugTabTuningButtonElement instanceof HTMLButtonElement ? pauseDebugTabTuningButtonElement : null, 'tuning']
  ]
  for (const [button, tabId] of pauseDebugTabButtons) {
    if (!button) {
      continue
    } // end if tab button missing
    button.addEventListener('click', () => {
      setPauseDebugActiveTab(tabId)
      updatePauseDebugTabs()
    })
  } // end for each pause debug tab button

  const syncPauseTuningInputs = (): void => {
    if (pauseTuneHeatMultiplierInput) pauseTuneHeatMultiplierInput.value = devHeatMultiplier.toFixed(2)
    if (pauseTuneEnergyRegenInput) pauseTuneEnergyRegenInput.value = devEnergyRegenRate.toFixed(2)
    if (pauseTuneCoolingRateInput) pauseTuneCoolingRateInput.value = devCoolingRate.toFixed(2)
    if (pauseTuneMovementScalingInput) pauseTuneMovementScalingInput.value = devMovementScale.toFixed(2)
    if (pauseTuneStaggerScalingInput) pauseTuneStaggerScalingInput.value = devStaggerScale.toFixed(2)
    if (pauseTuneTractionMultiplierInput) pauseTuneTractionMultiplierInput.value = devTractionMultiplier.toFixed(2)
    if (pauseTuneDriftMultiplierInput) pauseTuneDriftMultiplierInput.value = devDriftMultiplier.toFixed(2)
    if (pauseTuneAudioPitchScalingInput) pauseTuneAudioPitchScalingInput.value = devAudioPitchScale.toFixed(2)
    if (pauseTuneAudioVolumeScalingInput) pauseTuneAudioVolumeScalingInput.value = devAudioVolumeScale.toFixed(2)
  } // end function syncPauseTuningInputs

  const tuningInputs: Array<HTMLInputElement | null> = [
    pauseTuneHeatMultiplierInput,
    pauseTuneEnergyRegenInput,
    pauseTuneCoolingRateInput,
    pauseTuneMovementScalingInput,
    pauseTuneStaggerScalingInput,
    pauseTuneTractionMultiplierInput,
    pauseTuneDriftMultiplierInput,
    pauseTuneAudioPitchScalingInput,
    pauseTuneAudioVolumeScalingInput
  ]
  for (const inputElement of tuningInputs) {
    if (!(inputElement instanceof HTMLInputElement)) {
      continue
    } // end if tuning input missing
    inputElement.addEventListener('input', () => {
      applyPauseDebugTuningValues()
      updatePauseDebugTabs()
    })
  } // end for each tuning input

  syncPauseTuningInputs()
  applyPauseDebugTuningValues()
  setPauseDebugActiveTab('runtime')

  renderNavigationPoiMenu()
  updateNavigationOverlayVisibility(false)

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyM' || event.repeat || isConsoleOpen || isEditorModalOpen || isWeaponEditorOpen) {
      return
    } // end if not menu toggle key or conflicting modal state

    event.preventDefault()
    toggleNavigationMenu()
  })

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

    if (isNavigationMenuOpen) {
      closeNavigationMenu()
      return
    } // end if closing navigation menu

    void togglePause()
  })

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Backquote' || event.repeat || isEditorModalOpen || isWeaponEditorOpen || isNavigationMenuOpen) {
      return
    } // end if not developer console key or another editor is open

    event.preventDefault()
    if (isConsoleOpen) {
      void closeDeveloperConsole()
      return
    } // end if toggling console closed

    void openDeveloperConsole()
  })

  document.addEventListener('keydown', (event) => {
    if (event.repeat || isEditorModalOpen || isWeaponEditorOpen) {
      return
    } // end if editor modal blocks debug overlay shortcuts

    if (event.code === 'F3') {
      event.preventDefault()
      setRuntimeDebugOverlayVisible(!isRuntimeDebugOverlayVisible)
      updateRuntimeDebugOverlay()
      return
    } // end if toggling runtime debug overlay

    if (!isRuntimeDebugOverlayVisible) {
      return
    } // end if overlay-only shortcuts require overlay visibility

    if (event.code === 'F4') {
      event.preventDefault()
      dumpRuntimeDebugOverlay()
      return
    } // end if runtime debug dump requested

    if (event.code === 'F6') {
      event.preventDefault()
      speakRuntimeDebugSummary()
    } // end if runtime debug speech requested
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
    } else if (event.code === 'Numpad5') {
      event.preventDefault()
      openEnemyEditorModal('bruiser')
    } else if (event.code === 'NumpadDecimal') {
      event.preventDefault()
      openEnemyEditorModal('test-dummy')
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

  // Radar test cluster: 2 tanks + 1 striker placed ~70 units east of player spawn (200, 500),
  // outside engage range but already inside mid-range radar detection range at spawn.
  spawnEnemyAtPosition(combatWorld, 270, 500, 'tank')
  spawnEnemyAtPosition(combatWorld, 274, 504, 'tank')
  spawnEnemyAtPosition(combatWorld, 268, 496, 'striker')

  const targetLockState = createTargetLockState()
  let lastTimeMs = 0
  let previousPlayerX = player.x
  let previousPlayerY = player.y
  let previousPlayerZ = player.z ?? 0
  const worldOriginX = MAP_WIDTH / 2
  const worldOriginY = MAP_HEIGHT / 2

  const mapToCenteredCoordinates = (mapX: number, mapY: number): { x: number; y: number } => {
    return {
      x: mapX - worldOriginX,
      y: worldOriginY - mapY
    } // end object centered coordinates
  } // end function mapToCenteredCoordinates

  const centeredToMapCoordinates = (centeredX: number, centeredY: number): { x: number; y: number } => {
    return {
      x: centeredX + worldOriginX,
      y: worldOriginY - centeredY
    } // end object map coordinates
  } // end function centeredToMapCoordinates

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

  const speakCoordinates = (mapX: number, mapY: number): void => {
    if (!('speechSynthesis' in window)) {
      return
    } // end if speech synthesis unavailable

    const centered = mapToCenteredCoordinates(mapX, mapY)
    const xRounded = Math.round(centered.x * 10) / 10
    const yRounded = Math.round(centered.y * 10) / 10
    const utterance = new SpeechSynthesisUtterance(`Coordinates X ${xRounded}, Y ${yRounded}`)
    utterance.rate = 1
    utterance.pitch = 1
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  } // end function speakCoordinates

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

  const parseTeleportArguments = (rawCommandLine: string, args: string[]): { x: number; y: number; z: number } => {
    const callMatch = rawCommandLine.match(/^(tp|teleport)\s*\((.*)\)\s*$/i)
    if (callMatch) {
      const argumentSource = callMatch[2] ?? ''
      const values = argumentSource
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)

      if (values.length < 2 || values.length > 3) {
        throw new Error('Usage: tp(x, y, z) or tp <x> <y> [z]')
      } // end if function-style teleport argument count is invalid

      const x = parseFiniteNumber(values[0] ?? '', 'tp x')
      const y = parseFiniteNumber(values[1] ?? '', 'tp y')
      const z = values[2] !== undefined ? parseFiniteNumber(values[2], 'tp z') : (player.z ?? 0)
      return { x, y, z }
    } // end if function-style teleport syntax matched

    if (args.length < 2) {
      throw new Error('Usage: tp(x, y, z) or tp <x> <y> [z]')
    } // end if positional teleport arguments are incomplete

    const x = parseFiniteNumber(args[0] ?? '', 'tp x')
    const y = parseFiniteNumber(args[1] ?? '', 'tp y')
    const z = args[2] !== undefined ? parseFiniteNumber(args[2], 'tp z') : (player.z ?? 0)
    return { x, y, z }
  } // end function parseTeleportArguments

  const toDevPartSlot = (rawSlot: string): DevPartSlot => {
    const matched = DEV_PART_SLOTS.find((slot) => slot.toLowerCase() === rawSlot.trim().toLowerCase())
    if (!matched) {
      throw new Error(`Unknown slot: ${rawSlot}.`) 
    } // end if unknown slot requested
    return matched
  } // end function toDevPartSlot

  const getDevTotalWeight = (): number => {
    let total = 0
    for (const part of devParts.values()) {
      if (part.online) {
        total += part.weight
      }
    } // end for each part
    return total
  } // end function getDevTotalWeight

  const getDevTotalPdef = (): number => {
    let total = 0
    for (const part of devParts.values()) {
      if (part.online) {
        total += part.PDEF
      }
    } // end for each part
    return total
  } // end function getDevTotalPdef

  const getDevTotalEdef = (): number => {
    let total = 0
    for (const part of devParts.values()) {
      if (part.online) {
        total += part.EDEF
      }
    } // end for each part
    return total
  } // end function getDevTotalEdef

  const nextEventTag = (label: string): string => {
    devEventCounter += 1
    const timestampSeconds = (performance.now() / 1000).toFixed(1)
    devLastEvent = `${timestampSeconds} ${label}`
    devEventLog.unshift(devLastEvent)
    while (devEventLog.length > 120) {
      devEventLog.pop()
    } // end while trimming event history
    return devLastEvent
  } // end function nextEventTag

  const formatDevPart = (slot: DevPartSlot): string => {
    const part = devParts.get(slot)
    if (!part) {
      return `${slot}: <missing>`
    } // end if part placeholder is unexpectedly missing

    return `${slot}: ${part.name} (${part.partId}) integrity:${part.integrity.toFixed(1)}/${part.maxIntegrity.toFixed(1)} ${part.online ? 'ONLINE' : 'OFFLINE'}`
  } // end function formatDevPart

  const getPlayerMovementStateLabel = (): string => {
    if (player.isBoosting) {
      return 'boosting'
    } // end if player is boosting
    if (player.isFlying) {
      return player.flightState ?? 'airborne'
    } // end if player is flying
    return 'grounded'
  } // end function getPlayerMovementStateLabel

  const setRuntimeDebugOverlayVisible = (visible: boolean): void => {
    if (!(runtimeDebugOverlayElement instanceof HTMLElement)) {
      return
    } // end if runtime debug overlay is unavailable

    runtimeDebugOverlayElement.style.display = visible ? 'block' : 'none'
    runtimeDebugOverlayElement.setAttribute('aria-hidden', visible ? 'false' : 'true')
    isRuntimeDebugOverlayVisible = visible
  } // end function setRuntimeDebugOverlayVisible

  const getHeatStateLabel = (): string => {
    const ratio = devCurrentHeat / Math.max(1, devMaxHeat)
    if (ratio >= 1) {
      return 'overheated'
    }
    if (ratio >= 0.75) {
      return 'high'
    }
    if (ratio >= 0.35) {
      return 'elevated'
    }
    return 'stable'
  } // end function getHeatStateLabel

  const getEnergyStateLabel = (): string => {
    const ratio = player.ep / Math.max(1, player.maxEp)
    if (ratio <= 0) {
      return 'starved'
    }
    if (ratio <= 0.2) {
      return 'critical'
    }
    if (ratio <= 0.5) {
      return 'low'
    }
    return 'stable'
  } // end function getEnergyStateLabel

  const inferMobilityType = (): string => {
    const movementPart = devParts.get('Movement')
    const source = `${movementPart?.partId ?? ''} ${movementPart?.name ?? ''}`.toLowerCase()
    if (source.includes('wheel')) {
      return 'Wheels'
    }
    if (source.includes('tread')) {
      return 'Treads'
    }
    if (source.includes('hover')) {
      return 'Hover'
    }
    if (source.includes('walker') || source.includes('leg')) {
      return 'Walker'
    }
    if (source.includes('flight')) {
      return 'Flight'
    }
    return 'Placeholder'
  } // end function inferMobilityType

  const getRuntimeDebugOverlayLines = (): string[] => {
    const headingDegrees = normalizeDegrees((player.angle * 180) / Math.PI)
    const totalWeight = getDevTotalWeight()
    const ratedLoad = 100
    const weightFactor = totalWeight / Math.max(1, ratedLoad)
    const movementSpeedLimit = player.isFlying ? PLAYER_FLIGHT_SPEED : PLAYER_SPEED
    const turnSpeedDegrees = (TURN_SPEED * 180) / Math.PI
    const activeTimers = Array.from(devTimers.entries()).filter((entry) => Math.abs(entry[1]) > 0.0001).length
    const audioVoicesEstimate = Math.max(2, devEnemyCount + devProjectileCount + (player.isFlying ? 1 : 0) + (audio.isServoPlaying() ? 1 : 0))
    const loopState = player.isFlying
      ? (player.isBoosting ? 'flight+boost' : 'flight')
      : (audio.isServoPlaying() ? 'servo' : 'idle')

    const lines: string[] = [
      'PLAYER',
      `Position: (${player.x.toFixed(2)}, ${player.y.toFixed(2)}, ${(player.z ?? 0).toFixed(2)})`,
      `Velocity: (${devVelocityX.toFixed(2)}, ${devVelocityY.toFixed(2)}, ${devVelocityZ.toFixed(2)})`,
      `Heading: ${headingDegrees.toFixed(1)} deg`,
      `Grounded: ${player.flightState === 'grounded' ? 'true' : 'false'}`,
      `Flying: ${player.isFlying ? 'true' : 'false'}`,
      `Boosting: ${player.isBoosting ? 'true' : 'false'}`,
      `Target Locked: ${devTargetLockedId === null ? 'false' : `true (id ${devTargetLockedId})`}`,
      '',
      'CORE STATS',
      `Current Heat / Max Heat: ${devCurrentHeat.toFixed(1)} / ${devMaxHeat.toFixed(1)}`,
      `Current Energy / Max Energy: ${player.ep.toFixed(1)} / ${player.maxEp.toFixed(1)}`,
      `Total Weight: ${totalWeight.toFixed(1)}`,
      `Weight Factor: ${weightFactor.toFixed(3)} (TODO Ticket 6 formula)`,
      `Heat State: ${getHeatStateLabel()}`,
      `Energy State: ${getEnergyStateLabel()}`,
      `Movement State: ${getPlayerMovementStateLabel()}`,
      '',
      'MOVEMENT',
      `Mobility Type: ${inferMobilityType()}`,
      `Forward Speed: ${movementSpeedLimit.toFixed(2)}`,
      `Reverse Speed: ${movementSpeedLimit.toFixed(2)} (placeholder)`,
      `Strafe Speed: ${movementSpeedLimit.toFixed(2)} (placeholder)`,
      `Turn Speed: ${turnSpeedDegrees.toFixed(2)} deg/s`,
      `Acceleration: ${devApproxAcceleration.toFixed(2)} m/s^2 (sampled)`,
      `Flight Thrust: ${PLAYER_FLIGHT_SPEED.toFixed(2)} (placeholder)`,
      `Lift Capacity: ${getSharedFlightHeight().toFixed(2)} (placeholder)`,
      'Terrain Multiplier: 1.000 (TODO movement subsystem)',
      '',
      'DEFENSE',
      `Total PDEF: ${getDevTotalPdef().toFixed(1)}`,
      `Total EDEF: ${getDevTotalEdef().toFixed(1)}`,
      'Stagger Resistance: TODO (Ticket 9)',
      '',
      'PERFORMANCE',
      `FPS: ${devFps.toFixed(1)}`,
      `Entity Count: ${1 + devEnemyCount + devProjectileCount}`,
      `Projectile Count: ${devProjectileCount}`,
      `Audio Voices: ~${audioVoicesEstimate} (estimated)`,
      `Active Timers: ${activeTimers}`,
      '',
      'COMBAT',
      `Last Damage Taken: ${devLastDamageAmount.toFixed(1)}`,
      `Last Damage Type: ${devLastDamageType}`,
      `Last Hit Location: ${devLastHitLocation}`,
      `Last Heat Gain: ${devLastHeatGain.toFixed(2)}`,
      `Last Energy Drain: ${devLastEnergyDrain.toFixed(2)} /s`,
      '',
      'AUDIO',
      `Current Audio Event: ${devLastEvent}`,
      'Playback Rate: 1.00 (TODO expose audio playback-rate metrics)',
      `Volume: master=${audio.getVolumeChannel('master').toFixed(2)} music=${audio.getVolumeChannel('music').toFixed(2)} ambience=${audio.getVolumeChannel('ambience').toFixed(2)}`,
      `Loop State: ${loopState}`,
      '',
      'PART STATUS'
    ]

    for (const slot of DEV_PART_SLOTS) {
      const part = devParts.get(slot)
      if (!part) {
        lines.push(`${slot}: <missing>`)
        continue
      }
      lines.push(`${slot}: ${part.name} | integrity ${part.integrity.toFixed(1)}/${part.maxIntegrity.toFixed(1)} | ${part.online ? 'ONLINE' : 'OFFLINE'}`)
    } // end for each slot

    return lines
  } // end function getRuntimeDebugOverlayLines

  const updateRuntimeDebugOverlay = (): void => {
    if (!(runtimeDebugContentElement instanceof HTMLElement) || !isRuntimeDebugOverlayVisible) {
      return
    } // end if overlay content cannot be updated

    const lines = getRuntimeDebugOverlayLines()
    runtimeDebugContentElement.textContent = lines.join('\n')

    if (runtimeDebugSpeechStatusElement instanceof HTMLElement) {
      runtimeDebugSpeechStatusElement.textContent = `Debug overlay updated. Heat ${Math.round(devCurrentHeat)} of ${Math.round(devMaxHeat)}. Energy ${Math.round(player.ep)} of ${Math.round(player.maxEp)}. Enemies ${devEnemyCount}.`
    } // end if screen-reader status element exists
  } // end function updateRuntimeDebugOverlay

  const dumpRuntimeDebugOverlay = (): void => {
    const lines = getRuntimeDebugOverlayLines()
    console.log(`[runtime-debug-overlay]\n${lines.join('\n')}`)
    devConsole?.print(['[runtime debug dump]', ...lines])
  } // end function dumpRuntimeDebugOverlay

  const speakRuntimeDebugSummary = (): void => {
    if (!('speechSynthesis' in window)) {
      return
    } // end if speech synthesis is unavailable

    const summary = `Debug summary. Heat ${Math.round(devCurrentHeat)} of ${Math.round(devMaxHeat)}. Energy ${Math.round(player.ep)} of ${Math.round(player.maxEp)}. Enemies ${devEnemyCount}. Projectiles ${devProjectileCount}. Movement ${getPlayerMovementStateLabel()}.`
    const utterance = new SpeechSynthesisUtterance(summary)
    utterance.rate = 1
    utterance.pitch = 1
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  } // end function speakRuntimeDebugSummary

  const audioCategories: AudioCategory[] = ['proximity', 'objects', 'enemies', 'navigation']
  const enemyIds: EnemyId[] = ['tank', 'striker', 'brute', 'helicopter', 'bruiser', 'test-dummy']

  const getStateLines = (): string[] => {
    const centered = mapToCenteredCoordinates(player.x, player.y)

    return [
      `paused = ${isPaused}`,
      `console.open = ${isConsoleOpen}`,
      `player = mapX:${player.x.toFixed(2)} mapY:${player.y.toFixed(2)} centeredX:${centered.x.toFixed(2)} centeredY:${centered.y.toFixed(2)} z:${(player.z ?? 0).toFixed(2)} angle:${((player.angle * 180) / Math.PI).toFixed(1)} pitch:${((player.pitch * 180) / Math.PI).toFixed(1)}`,
      `player vitals = hp:${player.hp.toFixed(1)}/${player.maxHp.toFixed(1)} ep:${player.ep.toFixed(1)}/${player.maxEp.toFixed(1)}`,
      `player.flight = state:${player.flightState ?? 'grounded'} flying:${player.isFlying ? 'true' : 'false'} sharedHeight:${getSharedFlightHeight().toFixed(2)}`,
      `music.track = ${audio.getMusicTrack()}`,
      `weapon = type:${playerWeapon.weaponType} accuracy:${playerWeapon.accuracy.toFixed(2)} pellets:${playerWeapon.projectileCount} spread:${playerWeapon.spreadDegrees.toFixed(1)} damage:${playerWeapon.damagePerShot} speed:${playerWeapon.bulletSpeed.toFixed(2)} range:${playerWeapon.maxRange.toFixed(2)} fullAuto:${playerWeapon.isFullAuto} fireRate:${playerWeapon.fireRateCooldownSeconds.toFixed(2)} clip:${playerWeapon.ammoInClip}/${playerWeapon.clipSize} reloadCost:${getWeaponReloadCost(playerWeapon)}`,
      `ammo.universal = ${Math.round(universalAmmoResource)} reloading:${isReloading}`,
      `audio volumes = master:${audio.getVolumeChannel('master').toFixed(2)} ambience:${audio.getVolumeChannel('ambience').toFixed(2)} music:${audio.getVolumeChannel('music').toFixed(2)} footsteps:${audio.getVolumeChannel('footsteps').toFixed(2)} servo:${audio.getVolumeChannel('servo').toFixed(2)} energy:${audio.getVolumeChannel('energyStatus').toFixed(2)}`,
      `audio categories = proximity:${audio.getCategoryEnabled('proximity')}@${audio.getVolumeChannel('proximity').toFixed(2)} objects:${audio.getCategoryEnabled('objects')}@${audio.getVolumeChannel('objects').toFixed(2)} enemies:${audio.getCategoryEnabled('enemies')}@${audio.getVolumeChannel('enemies').toFixed(2)} navigation:${audio.getCategoryEnabled('navigation')}@${audio.getVolumeChannel('navigation').toFixed(2)}`
    ]
  } // end function getStateLines

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
    'player.hp': {
      description: 'Player health points from 0 to player.maxHp.',
      helpPath: ['Player', 'Vitals'],
      get: () => player.hp,
      set: (rawValue) => {
        player.hp = Math.max(0, Math.min(player.maxHp, parseFiniteNumber(rawValue, 'player.hp')))
        return player.hp
      }
    },
    'player.ep': {
      description: 'Player energy points from 0 to player.maxEp.',
      helpPath: ['Player', 'Vitals'],
      get: () => player.ep,
      set: (rawValue) => {
        player.ep = Math.max(0, Math.min(player.maxEp, parseFiniteNumber(rawValue, 'player.ep')))
        return player.ep
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
    'audio.music.volume': {
      description: 'Background music volume scalar from 0 to 2.',
      helpPath: ['Audio', 'Mix'],
      get: () => audio.getVolumeChannel('music'),
      set: (rawValue) => audio.setVolumeChannel('music', parseFiniteNumber(rawValue, 'audio.music.volume'))
    },
    'audio.music.track': {
      description: 'Currently playing background music track by name.',
      helpPath: ['Audio', 'Mix'],
      get: () => audio.getMusicTrack(),
      set: (rawValue) => audio.setMusicTrack(rawValue)
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
    'audio.energy.volume': {
      description: 'Player energy status loop volume scalar from 0 to 2.',
      helpPath: ['Audio', 'Mix'],
      get: () => audio.getVolumeChannel('energyStatus'),
      set: (rawValue) => audio.setVolumeChannel('energyStatus', parseFiniteNumber(rawValue, 'audio.energy.volume'))
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
      syntax: 'music [trackName]',
      description: 'Show or set the current background music track by name.',
      helpPath: ['Audio', 'Mix'],
      aliases: ['track'],
      examples: ['music', 'music slowDrone', 'music scary', 'set audio.music.track suspense']
    },
    {
      syntax: 'spawn <enemyId>',
      description: 'Spawn an enemy: tank, striker, brute, or helicopter.',
      helpPath: ['Enemies', 'Spawning'],
      examples: ['spawn tank', 'spawn helicopter']
    },
    {
      syntax: 'spawn enemy <enemyId>',
      description: 'Ticket alias for enemy spawning commands.',
      helpPath: ['Enemies', 'Spawning'],
      examples: ['spawn enemy tank']
    },
    {
      syntax: 'player.get <view>',
      description: 'Inspect player values using Ticket views such as all, stats, heat, and target.',
      helpPath: ['Player', 'Vitals'],
      examples: ['player.get all', 'player.get heat']
    },
    {
      syntax: 'part.get <slot>',
      description: 'Inspect placeholder part state by slot, integrity, stats, or state.',
      helpPath: ['Gameplay', 'Session'],
      examples: ['part.get all', 'part.get LeftHand integrity']
    },
    {
      syntax: 'player.set <field> <value>',
      description: 'Set ticket-focused player values: heat, energy, and aggregate placeholder weight.',
      helpPath: ['Player', 'Vitals'],
      examples: ['player.set heat 85', 'player.set energy 600']
    },
    {
      syntax: 'part.set <slot> <action>',
      description: 'Set part integrity or force slot state online/offline.',
      helpPath: ['Gameplay', 'Session'],
      examples: ['part.set LeftHand integrity 0', 'part.set Generator offline']
    },
    {
      syntax: 'part.attach <partId> <slot>',
      description: 'Attach a placeholder part identifier to the specified slot.',
      helpPath: ['Gameplay', 'Session']
    },
    {
      syntax: 'part.detach <slot>',
      description: 'Detach the slot and revert it to a placeholder part entry.',
      helpPath: ['Gameplay', 'Session']
    },
    {
      syntax: 'player.damage <amount> <type>',
      description: 'Apply direct player damage for combat testing.',
      helpPath: ['Gameplay', 'Session'],
      examples: ['player.damage 25 physical', 'player.damage 40 energy']
    },
    {
      syntax: 'player.stagger',
      description: 'Trigger the stagger test hook (placeholder until stagger pipeline is integrated).',
      helpPath: ['Gameplay', 'Session']
    },
    {
      syntax: 'player.overheat',
      description: 'Set the player heat value to max.',
      helpPath: ['Gameplay', 'Session']
    },
    {
      syntax: 'player.shutdown',
      description: 'Force player shutdown behavior for testing.',
      helpPath: ['Gameplay', 'Session']
    },
    {
      syntax: 'kill all',
      description: 'Remove all hostile entities and active projectiles.',
      helpPath: ['Enemies', 'Spawning']
    },
    {
      syntax: 'time.scale <value>',
      description: 'Scale simulation time from 0.00 to 4.00.',
      helpPath: ['Gameplay', 'Session']
    },
    {
      syntax: 'ai.enable',
      description: 'Enable AI simulation steps.',
      helpPath: ['Gameplay', 'Session']
    },
    {
      syntax: 'ai.disable',
      description: 'Disable AI simulation steps.',
      helpPath: ['Gameplay', 'Session']
    },
    {
      syntax: 'physics.debug on|off',
      description: 'Toggle placeholder physics debug flag.',
      helpPath: ['Gameplay', 'Session']
    },
    {
      syntax: 'audio.debug on|off',
      description: 'Toggle placeholder audio debug flag.',
      helpPath: ['Audio', 'Mix']
    },
    {
      syntax: 'events.debug on|off',
      description: 'Toggle placeholder event debug flag.',
      helpPath: ['Console', 'Utility']
    },
    {
      syntax: 'save.build <name>',
      description: 'Save a local build snapshot in browser storage.',
      helpPath: ['Console', 'Utility']
    },
    {
      syntax: 'load.build <name>',
      description: 'Load a previously saved local build snapshot.',
      helpPath: ['Console', 'Utility']
    },
    {
      syntax: 'reset.build',
      description: 'Reset build snapshot values to placeholder defaults.',
      helpPath: ['Console', 'Utility']
    },
    {
      syntax: 'tp(x, y, z)',
      description: 'Teleport to centered coordinates where +X is east and +Y is north.',
      helpPath: ['Player', 'Position'],
      aliases: ['teleport'],
      examples: ['tp(100, 220, 0)', 'tp -40 15', 'teleport(0, 0, 0)']
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

    const commandToken = (tokens[0] ?? '').toLowerCase()
    const command = commandToken.startsWith('tp(')
      ? 'tp'
      : commandToken.startsWith('teleport(')
        ? 'teleport'
        : commandToken
    const args = tokens.slice(1)
    const bindings = getConsoleBindings()
    const normalizedCommand = commandLine.trim().replace(/\s+/g, ' ').toLowerCase()

    if (normalizedCommand === 'list systems') {
      return [
        'systems:',
        `  ai: ${devAiEnabled ? 'enabled' : 'disabled'}`,
        `  physicsDebug: ${devPhysicsDebugEnabled ? 'on' : 'off'}`,
        `  audioDebug: ${devAudioDebugEnabled ? 'on' : 'off'}`,
        `  eventsDebug: ${devEventsDebugEnabled ? 'on' : 'off'}`,
        `  timeScale: ${devTimeScale.toFixed(2)}`
      ]
    } // end if list systems command

    if (normalizedCommand === 'list parts') {
      return ['parts:', ...DEV_PART_SLOTS.map((slot) => `  ${formatDevPart(slot)}`)]
    } // end if list parts command

    if (normalizedCommand === 'list slots') {
      return ['slots:', ...DEV_PART_SLOTS.map((slot) => `  ${slot}`)]
    } // end if list slots command

    if (normalizedCommand === 'list weapons') {
      return [
        'weapons:',
        ...weaponLoadout.map((weapon, index) => `  ${weapon.id} (${weapon.weaponType})${index === activeWeaponIndex ? ' [equipped]' : ''}`)
      ]
    } // end if list weapons command

    if (normalizedCommand === 'list enemies') {
      const combatState = getCombatRenderState(combatWorld)
      const counts = getCombatEntityCounts(combatWorld)
      return [
        `enemy count: ${counts.enemies}`,
        ...combatState.tanks.slice(0, 20).map((tank) => `  id:${tank.id} type:${tank.enemyType} hp:${Math.round(tank.health)}/${Math.round(tank.maxHealth)} alive:${tank.alive}`)
      ]
    } // end if list enemies command

    if (normalizedCommand === 'list projectiles') {
      const counts = getCombatEntityCounts(combatWorld)
      return [`projectile count: ${counts.projectiles}`]
    } // end if list projectiles command

    if (normalizedCommand === 'list audio') {
      return [
        `audio.debug = ${devAudioDebugEnabled ? 'on' : 'off'}`,
        `track = ${audio.getMusicTrack()}`,
        `master = ${audio.getVolumeChannel('master').toFixed(2)}`,
        ...audioCategories.map((category) => `  ${category}: enabled=${audio.getCategoryEnabled(category)} volume=${audio.getVolumeChannel(category).toFixed(2)}`)
      ]
    } // end if list audio command

    if (normalizedCommand === 'list timers') {
      if (devTimers.size === 0) {
        return ['timers: none']
      } // end if no tracked timers
      return ['timers:', ...Array.from(devTimers.entries()).map(([name, value]) => `  ${name}=${value.toFixed(3)}`)]
    } // end if list timers command

    if (normalizedCommand === 'list events') {
      return ['events:', `  ${devLastEvent}`]
    } // end if list events command

    if (normalizedCommand.startsWith('player.get ')) {
      const mode = normalizedCommand.slice('player.get '.length)
      const targetId = targetLockState.lockedTankId
      const weight = getDevTotalWeight()
      if (mode === 'all') {
        return [
          `position = (${player.x.toFixed(2)}, ${player.y.toFixed(2)}, ${(player.z ?? 0).toFixed(2)})`,
          `velocity = (${devVelocityX.toFixed(2)}, ${devVelocityY.toFixed(2)}, ${devVelocityZ.toFixed(2)})`,
          `stats = hp:${player.hp.toFixed(1)}/${player.maxHp.toFixed(1)} ep:${player.ep.toFixed(1)}/${player.maxEp.toFixed(1)} heat:${devCurrentHeat.toFixed(1)}/${devMaxHeat.toFixed(1)} weight:${weight.toFixed(1)}`,
          `movement = ${getPlayerMovementStateLabel()}`,
          `target = ${targetId === null ? 'none' : String(targetId)}`
        ]
      } // end if player.get all
      if (mode === 'stats') {
        return [
          `hp = ${player.hp.toFixed(1)}/${player.maxHp.toFixed(1)}`,
          `ep = ${player.ep.toFixed(1)}/${player.maxEp.toFixed(1)}`,
          `heat = ${devCurrentHeat.toFixed(1)}/${devMaxHeat.toFixed(1)}`,
          `weight = ${weight.toFixed(1)}`,
          `PDEF = ${getDevTotalPdef().toFixed(1)}`,
          `EDEF = ${getDevTotalEdef().toFixed(1)}`
        ]
      } // end if player.get stats
      if (mode === 'heat') {
        return [`heat = ${devCurrentHeat.toFixed(1)}/${devMaxHeat.toFixed(1)}`]
      } // end if player.get heat
      if (mode === 'energy') {
        return [`energy = ${player.ep.toFixed(1)}/${player.maxEp.toFixed(1)}`]
      } // end if player.get energy
      if (mode === 'weight') {
        return [`weight = ${weight.toFixed(1)}`]
      } // end if player.get weight
      if (mode === 'movement') {
        return [`movement = ${getPlayerMovementStateLabel()} flightState:${player.flightState ?? 'grounded'} flying:${!!player.isFlying}`]
      } // end if player.get movement
      if (mode === 'position') {
        return [`position = (${player.x.toFixed(2)}, ${player.y.toFixed(2)}, ${(player.z ?? 0).toFixed(2)})`]
      } // end if player.get position
      if (mode === 'velocity') {
        return [`velocity = (${devVelocityX.toFixed(2)}, ${devVelocityY.toFixed(2)}, ${devVelocityZ.toFixed(2)})`]
      } // end if player.get velocity
      if (mode === 'target') {
        return [`target = ${targetId === null ? 'none' : String(targetId)}`]
      } // end if player.get target
      throw new Error('Usage: player.get <all|stats|heat|energy|weight|movement|position|velocity|target>')
    } // end if player.get command

    if (normalizedCommand.startsWith('part.get ')) {
      const rawArgs = commandLine.trim().split(/\s+/)
      const requestedSlot = rawArgs[1]
      if (!requestedSlot) {
        throw new Error('Usage: part.get <all|slot> [integrity|stats|state]')
      } // end if part slot missing
      if (requestedSlot.toLowerCase() === 'all') {
        return ['part.get all:', ...DEV_PART_SLOTS.map((slot) => `  ${formatDevPart(slot)}`)]
      } // end if listing all parts
      const slot = toDevPartSlot(requestedSlot)
      const part = devParts.get(slot)
      if (!part) {
        throw new Error(`Slot has no part data: ${slot}`)
      } // end if slot missing state
      const field = (rawArgs[2] ?? '').toLowerCase()
      if (field === '' || field === 'state') {
        return [`${slot} state = ${part.online ? 'ONLINE' : 'OFFLINE'}`]
      } // end if state requested
      if (field === 'integrity') {
        return [`${slot} integrity = ${part.integrity.toFixed(1)}/${part.maxIntegrity.toFixed(1)}`]
      } // end if integrity requested
      if (field === 'stats') {
        return [
          `${slot} stats:`,
          `  weight=${part.weight.toFixed(1)}`,
          `  PDEF=${part.PDEF.toFixed(1)}`,
          `  EDEF=${part.EDEF.toFixed(1)}`,
          `  energyDrain=${part.energyDrain.toFixed(1)}`
        ]
      } // end if part stats requested
      throw new Error('Usage: part.get <all|slot> [integrity|stats|state]')
    } // end if part.get command

    if (normalizedCommand.startsWith('player.set ')) {
      const rawArgs = commandLine.trim().split(/\s+/)
      const field = (rawArgs[1] ?? '').toLowerCase()
      const value = rawArgs.slice(2).join(' ')
      if (value.length <= 0) {
        throw new Error('Usage: player.set <heat|energy|weight> <value>')
      } // end if value missing
      if (field === 'heat') {
        devCurrentHeat = Math.max(0, Math.min(devMaxHeat, parseFiniteNumber(value, 'player.set heat')))
        nextEventTag(`Heat set to ${devCurrentHeat.toFixed(1)}`)
        return [`player.heat = ${devCurrentHeat.toFixed(1)}/${devMaxHeat.toFixed(1)}`]
      } // end if setting heat
      if (field === 'energy') {
        player.ep = Math.max(0, Math.min(player.maxEp, parseFiniteNumber(value, 'player.set energy')))
        nextEventTag(`Energy set to ${player.ep.toFixed(1)}`)
        return [`player.ep = ${player.ep.toFixed(1)}/${player.maxEp.toFixed(1)}`]
      } // end if setting energy
      if (field === 'weight') {
        const requestedWeight = Math.max(0, parseFiniteNumber(value, 'player.set weight'))
        const exoShell = devParts.get('ExoShell')
        if (exoShell) {
          exoShell.weight = requestedWeight
        }
        nextEventTag(`Weight set to ${requestedWeight.toFixed(1)}`)
        return [`player.weight = ${getDevTotalWeight().toFixed(1)}`]
      } // end if setting weight
      throw new Error('Usage: player.set <heat|energy|weight> <value>')
    } // end if player.set command

    if (normalizedCommand.startsWith('part.set ')) {
      const rawArgs = commandLine.trim().split(/\s+/)
      const slotRaw = rawArgs[1]
      if (!slotRaw) {
        throw new Error('Usage: part.set <slot> integrity <value> | offline | online')
      } // end if slot missing
      const slot = toDevPartSlot(slotRaw)
      const part = devParts.get(slot)
      if (!part) {
        throw new Error(`Slot has no part data: ${slot}`)
      } // end if missing slot data
      const action = (rawArgs[2] ?? '').toLowerCase()
      if (action === 'integrity') {
        const value = parseFiniteNumber(rawArgs[3] ?? '', `${slot} integrity`)
        part.integrity = Math.max(0, Math.min(part.maxIntegrity, value))
        part.online = part.integrity > 0
        nextEventTag(`${slot} integrity set to ${part.integrity.toFixed(1)}`)
        return [`${slot} integrity = ${part.integrity.toFixed(1)}/${part.maxIntegrity.toFixed(1)} (${part.online ? 'ONLINE' : 'OFFLINE'})`]
      } // end if setting integrity
      if (action === 'offline') {
        part.online = false
        nextEventTag(`${slot} forced OFFLINE`)
        return [`${slot} is OFFLINE`]
      } // end if forcing offline
      if (action === 'online') {
        part.online = true
        if (part.integrity <= 0) {
          part.integrity = 1
        }
        nextEventTag(`${slot} forced ONLINE`)
        return [`${slot} is ONLINE`]
      } // end if forcing online
      throw new Error('Usage: part.set <slot> integrity <value> | offline | online')
    } // end if part.set command

    if (normalizedCommand.startsWith('part.attach ')) {
      const rawArgs = commandLine.trim().split(/\s+/)
      const partId = rawArgs[1]
      const slotRaw = rawArgs[2]
      if (!partId || !slotRaw) {
        throw new Error('Usage: part.attach <partId> <slot>')
      } // end if part attach args missing
      const slot = toDevPartSlot(slotRaw)
      const part = devParts.get(slot)
      if (!part) {
        throw new Error(`Slot has no part data: ${slot}`)
      } // end if part state missing
      part.partId = partId
      part.name = partId
      part.online = true
      if (part.integrity <= 0) {
        part.integrity = part.maxIntegrity
      }
      nextEventTag(`Attached ${partId} to ${slot}`)
      return [`attached ${partId} to ${slot}`]
    } // end if part.attach command

    if (normalizedCommand.startsWith('part.detach ')) {
      const rawArgs = commandLine.trim().split(/\s+/)
      const slotRaw = rawArgs[1]
      if (!slotRaw) {
        throw new Error('Usage: part.detach <slot>')
      } // end if slot missing
      const slot = toDevPartSlot(slotRaw)
      const part = devParts.get(slot)
      if (!part) {
        throw new Error(`Slot has no part data: ${slot}`)
      } // end if part state missing
      part.partId = `placeholder.${slot}`
      part.name = `${slot} Placeholder`
      part.integrity = part.maxIntegrity
      part.online = false
      part.weight = 0
      part.PDEF = 0
      part.EDEF = 0
      part.energyDrain = 0
      nextEventTag(`Detached part from ${slot}`)
      return [`detached part from ${slot}`]
    } // end if part.detach command

    if (normalizedCommand.startsWith('player.damage ')) {
      const rawArgs = commandLine.trim().split(/\s+/)
      const amount = Math.max(0, parseFiniteNumber(rawArgs[1] ?? '', 'player.damage amount'))
      const damageType = (rawArgs[2] ?? 'physical').toLowerCase()
      player.hp = Math.max(0, player.hp - amount)
      devLastDamageAmount = amount
      devLastDamageType = damageType
      devLastHitLocation = 'center mass'
      devLastHeatGain = amount * 0.1 * devHeatMultiplier
      devCurrentHeat = Math.min(devMaxHeat, devCurrentHeat + devLastHeatGain)
      nextEventTag(`Player damaged: ${amount.toFixed(1)} ${damageType}`)
      return [`player.hp = ${player.hp.toFixed(1)}/${player.maxHp.toFixed(1)}`]
    } // end if player.damage command

    if (normalizedCommand === 'player.stagger') {
      nextEventTag('Player stagger triggered (placeholder)')
      return [`player.stagger: triggered with scale ${devStaggerScale.toFixed(2)} (TODO hook for stagger system).`]
    } // end if player.stagger command

    if (normalizedCommand === 'player.overheat') {
      devLastHeatGain = Math.max(0, devMaxHeat - devCurrentHeat)
      devCurrentHeat = devMaxHeat
      nextEventTag('Player overheat triggered')
      return [`player.heat = ${devCurrentHeat.toFixed(1)}/${devMaxHeat.toFixed(1)}`]
    } // end if player.overheat command

    if (normalizedCommand === 'player.shutdown') {
      player.ep = 0
      player.isBoosting = false
      player.isFlying = false
      player.flightState = 'grounded'
      if (audio.isAudioStarted()) {
        audio.stopBoostAudio()
        audio.stopFlightLoop()
      }
      nextEventTag('Player shutdown triggered')
      return ['player shutdown applied: ep=0, flight disabled, boost disabled.']
    } // end if player.shutdown command

    if (normalizedCommand.startsWith('spawn enemy ')) {
      const enemyId = (commandLine.trim().split(/\s+/)[2] ?? '') as EnemyId
      if (!enemyIds.includes(enemyId)) {
        throw new Error(`Usage: spawn enemy <${enemyIds.join('|')}>`)
      } // end if enemy id invalid
      const spawned = spawnRandomEnemy(combatWorld, collisionWorld, player, enemyId)
      nextEventTag(`Spawn enemy: ${enemyId} (${spawned ? 'ok' : 'failed'})`)
      return [spawned ? `${enemyId} spawned.` : `No valid spawn location for ${enemyId}.`]
    } // end if spawn enemy command

    if (normalizedCommand === 'kill all') {
      const removed = clearCombatEntities(combatWorld)
      nextEventTag(`Kill all removed ${removed} entities`)
      return [`Removed ${removed} hostile/projectile entities.`]
    } // end if kill all command

    if (normalizedCommand.startsWith('time.scale ')) {
      const rawValue = commandLine.trim().split(/\s+/)[1] ?? ''
      devTimeScale = Math.max(0, Math.min(4, parseFiniteNumber(rawValue, 'time.scale')))
      nextEventTag(`Time scale set to ${devTimeScale.toFixed(2)}`)
      return [`time.scale = ${devTimeScale.toFixed(2)}`]
    } // end if time.scale command

    if (normalizedCommand === 'ai.enable') {
      devAiEnabled = true
      nextEventTag('AI enabled')
      return ['ai = enabled']
    } // end if ai.enable command

    if (normalizedCommand === 'ai.disable') {
      devAiEnabled = false
      nextEventTag('AI disabled')
      return ['ai = disabled']
    } // end if ai.disable command

    if (normalizedCommand === 'physics.debug on') {
      devPhysicsDebugEnabled = true
      nextEventTag('Physics debug enabled')
      return ['physics.debug = on']
    } // end if physics.debug on command

    if (normalizedCommand === 'physics.debug off') {
      devPhysicsDebugEnabled = false
      nextEventTag('Physics debug disabled')
      return ['physics.debug = off']
    } // end if physics.debug off command

    if (normalizedCommand === 'audio.debug on') {
      devAudioDebugEnabled = true
      nextEventTag('Audio debug enabled')
      return ['audio.debug = on']
    } // end if audio.debug on command

    if (normalizedCommand === 'audio.debug off') {
      devAudioDebugEnabled = false
      nextEventTag('Audio debug disabled')
      return ['audio.debug = off']
    } // end if audio.debug off command

    if (normalizedCommand === 'events.debug on') {
      devEventsDebugEnabled = true
      nextEventTag('Events debug enabled')
      return ['events.debug = on']
    } // end if events.debug on command

    if (normalizedCommand === 'events.debug off') {
      devEventsDebugEnabled = false
      nextEventTag('Events debug disabled')
      return ['events.debug = off']
    } // end if events.debug off command

    if (normalizedCommand.startsWith('save.build ')) {
      const name = commandLine.trim().slice('save.build '.length).trim()
      if (name.length <= 0) {
        throw new Error('Usage: save.build <name>')
      } // end if build name missing
      const snapshot = {
        player: {
          hp: player.hp,
          ep: player.ep,
          heat: devCurrentHeat,
          maxHeat: devMaxHeat,
          x: player.x,
          y: player.y,
          z: player.z ?? 0
        },
        parts: DEV_PART_SLOTS.map((slot) => ({ slot, part: devParts.get(slot) })),
        timeScale: devTimeScale,
        aiEnabled: devAiEnabled
      }
      localStorage.setItem(`mech.dev.build.${name}`, JSON.stringify(snapshot))
      nextEventTag(`Build saved: ${name}`)
      return [`Saved build "${name}".`]
    } // end if save.build command

    if (normalizedCommand.startsWith('load.build ')) {
      const name = commandLine.trim().slice('load.build '.length).trim()
      if (name.length <= 0) {
        throw new Error('Usage: load.build <name>')
      } // end if build name missing
      const rawSnapshot = localStorage.getItem(`mech.dev.build.${name}`)
      if (!rawSnapshot) {
        throw new Error(`No build saved with name "${name}".`)
      } // end if snapshot missing
      const snapshot = JSON.parse(rawSnapshot) as {
        player?: { hp?: number; ep?: number; heat?: number; maxHeat?: number; x?: number; y?: number; z?: number }
        parts?: Array<{ slot: DevPartSlot; part: DevPartState | undefined }>
        timeScale?: number
        aiEnabled?: boolean
      }
      if (snapshot.player) {
        if (Number.isFinite(snapshot.player.hp)) {
          player.hp = Math.max(0, Math.min(player.maxHp, snapshot.player.hp ?? player.hp))
        }
        if (Number.isFinite(snapshot.player.ep)) {
          player.ep = Math.max(0, Math.min(player.maxEp, snapshot.player.ep ?? player.ep))
        }
        if (Number.isFinite(snapshot.player.heat)) {
          devCurrentHeat = Math.max(0, snapshot.player.heat ?? devCurrentHeat)
        }
        if (Number.isFinite(snapshot.player.maxHeat)) {
          devMaxHeat = Math.max(1, snapshot.player.maxHeat ?? devMaxHeat)
        }
        if (Number.isFinite(snapshot.player.x) && Number.isFinite(snapshot.player.y)) {
          placePlayer(snapshot.player.x ?? player.x, snapshot.player.y ?? player.y, snapshot.player.z ?? (player.z ?? 0))
        }
      }
      if (Array.isArray(snapshot.parts)) {
        for (const entry of snapshot.parts) {
          if (!entry || !DEV_PART_SLOTS.includes(entry.slot) || !entry.part) {
            continue
          }
          devParts.set(entry.slot, { ...entry.part })
        }
      }
      if (Number.isFinite(snapshot.timeScale)) {
        devTimeScale = Math.max(0, Math.min(4, snapshot.timeScale ?? devTimeScale))
      }
      if (typeof snapshot.aiEnabled === 'boolean') {
        devAiEnabled = snapshot.aiEnabled
      }
      nextEventTag(`Build loaded: ${name}`)
      return [`Loaded build "${name}".`]
    } // end if load.build command

    if (normalizedCommand === 'reset.build') {
      player.hp = player.maxHp
      player.ep = player.maxEp
      devCurrentHeat = 0
      devMaxHeat = 100
      devTimeScale = 1
      devAiEnabled = true
      devPhysicsDebugEnabled = false
      devAudioDebugEnabled = false
      devEventsDebugEnabled = false
      for (const slot of DEV_PART_SLOTS) {
        devParts.set(slot, {
          partId: `placeholder.${slot}`,
          name: `${slot} Placeholder`,
          integrity: 100,
          maxIntegrity: 100,
          online: true,
          weight: 0,
          PDEF: 0,
          EDEF: 0,
          energyDrain: 0
        })
      }
      nextEventTag('Build reset to placeholder defaults')
      return ['Build reset to defaults.']
    } // end if reset.build command

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

    if (command === 'music' || command === 'track') {
      if (args.length === 0) {
        return [
          `music = ${audio.getMusicTrack()}`,
          `available = ${audio.getMusicTracks().join(', ')}`
        ]
      } // end if reporting current music track

      const requestedTrack = args.join(' ')
      const track = audio.setMusicTrack(requestedTrack)
      return [`music = ${track}`]
    } // end if music command

    if (command === 'tp' || command === 'teleport') {
      const destination = parseTeleportArguments(commandLine, args)
      const mapDestination = centeredToMapCoordinates(destination.x, destination.y)
      placePlayer(mapDestination.x, mapDestination.y, destination.z)
      const centeredPosition = mapToCenteredCoordinates(player.x, player.y)
      return [
        `Teleported to centered (${centeredPosition.x.toFixed(2)}, ${centeredPosition.y.toFixed(2)}, ${(player.z ?? 0).toFixed(2)})`,
        `Map position (${player.x.toFixed(2)}, ${player.y.toFixed(2)}, ${(player.z ?? 0).toFixed(2)})`
      ]
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

    if (currentCommand === 'music' || currentCommand === 'track') {
      const currentTrack = hasTrailingWhitespace ? '' : ((tokens[1] ?? '').toLowerCase())
      return audio.getMusicTracks()
        .filter((trackName) => trackName.toLowerCase().startsWith(currentTrack))
        .map((trackName) => `music ${trackName}`)
    } // end if completing music track

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
      'window.mechDev.execute("set audio.energy.volume 1.6")',
      'window.mechDev.execute("set audio.music.volume 0.2")',
      'window.mechDev.execute("set player.hp 150")',
      'window.mechDev.execute("set player.ep 75")',
      'window.mechDev.execute("music suspense")',
      'window.mechDev.setSharedFlightHeight(4)',
      'window.mechDev.setPlayerAltitude(1.5)',
      "window.mechDev.spawnEnemy('helicopter')",
      'window.mechDev.pause()',
      'window.mechDev.resume()'
    ],
    getState: () => ({
      centeredPlayer: {
        x: mapToCenteredCoordinates(player.x, player.y).x,
        y: mapToCenteredCoordinates(player.x, player.y).y,
        z: player.z ?? 0
      },
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
    const baseDeltaSeconds = Math.min((timestampMs - lastTimeMs) / 1000, 0.05)
    lastTimeMs = timestampMs
    const deltaSeconds = baseDeltaSeconds * devTimeScale

    if (baseDeltaSeconds > 0) {
      const sampledFps = 1 / baseDeltaSeconds
      devFps = devFps <= 0 ? sampledFps : (devFps * 0.9) + (sampledFps * 0.1)
    } // end if FPS sample is valid

    if (isPaused) {
      updateRuntimeDebugOverlay()
      updatePauseDebugTabs()
      requestAnimationFrame(gameLoop)
      return
    } // end if game paused

    playerFireCooldownSeconds = Math.max(0, playerFireCooldownSeconds - deltaSeconds)
    playerMeleeCooldownSeconds = Math.max(0, playerMeleeCooldownSeconds - deltaSeconds)

    if (input.selectedWeaponSlot !== null) {
      const selectedIndex = input.selectedWeaponSlot - 1
      input.selectedWeaponSlot = null
      if (!isReloading && selectedIndex !== activeWeaponIndex && selectedIndex >= 0 && selectedIndex < weaponLoadout.length) {
        equipWeaponAtIndex(selectedIndex)
      } // end if selected weapon changed
    } // end if selected weapon slot pending

    if (input.reloadPending) {
      input.reloadPending = false
      tryStartWeaponReload()
    } // end if manual reload requested

    const snapWasRequested = input.snapNorthPending
      || input.snapEastPending
      || input.snapSouthPending
      || input.snapWestPending
      || input.snapLeftPending
      || input.snapRightPending
    if (snapWasRequested) {
      targetLockState.lockedTankId = null
      missileLockProgressMs = 0
      missileLockTargetId = null
      missileLockConfirmed = false
      missileLockToneTimerSeconds = 0
      audio.playLockLostChirp()
    } // end if directional snap requested

    const movementDeltaSeconds = deltaSeconds
      * Math.max(0, devMovementScale)
      * Math.max(0.1, devTractionMultiplier)
      / Math.max(0.1, devDriftMultiplier)

    updateFrame(
      {
        player,
        input,
        audio,
        state: updateState,
        flightAltitude: getSharedFlightHeight(),
        collisionWorld
      },
      movementDeltaSeconds
    )

    if (deltaSeconds > 0) {
      const currentZ = player.z ?? 0
      devVelocityX = (player.x - devPrevX) / deltaSeconds
      devVelocityY = (player.y - devPrevY) / deltaSeconds
      devVelocityZ = (currentZ - devPrevZ) / deltaSeconds
      const currentSpeed = Math.hypot(devVelocityX, devVelocityY, devVelocityZ)
      devApproxAcceleration = (currentSpeed - devPreviousSpeed) / deltaSeconds
      devPreviousSpeed = currentSpeed
      devPrevX = player.x
      devPrevY = player.y
      devPrevZ = currentZ
    } // end if velocity sample is valid

    const hpBeforeCombat = Math.max(0, player.hp)

    const energyRegenPerSecond = devEnergyRegenRate
    const energyDrainPerSecond = (player.isFlying ? 2 : 0) + ((player.isBoosting ?? false) ? BOOST_EP_DRAIN_PER_SECOND : 0)
    devLastEnergyDrain = Math.max(0, energyDrainPerSecond)
    const epDelta = (energyRegenPerSecond - energyDrainPerSecond) * deltaSeconds
    player.ep = Math.max(0, Math.min(player.maxEp, player.ep + epDelta))
    devCurrentHeat = Math.max(0, devCurrentHeat - (devCoolingRate * deltaSeconds))

    // Force landing when EP is fully depleted while in flight
    if (player.ep <= 0 && player.isFlying &&
        player.flightState !== 'descending' && player.flightState !== 'grounded') {
      if (player.isBoosting) {
        player.isBoosting = false
        if (audio.isAudioStarted()) {
          audio.stopBoostAudio()
        } // end if stopping boost audio on EP depletion
      } // end if was boosting
      player.flightState = 'descending'
      if (audio.isAudioStarted()) {
        audio.stopFlightLoop()
      } // end if stopping flight loop on EP depletion
    } // end if EP depleted while flying

    if (input.speakHpPending) {
      input.speakHpPending = false
      speakPercent('Health', player.hp, player.maxHp)
    } // end if HP speech requested

    if (input.speakEpPending) {
      input.speakEpPending = false
      speakPercent('Energy', player.ep, player.maxEp)
    } // end if EP speech requested

    if (input.speakCoordsPending) {
      input.speakCoordsPending = false
      speakCoordinates(player.x, player.y)
    } // end if coordinate speech requested

    if (input.speakDestinationPending) {
      input.speakDestinationPending = false
      speakCurrentDestinationStatus()
    } // end if destination speech requested

    if (input.refillEpPending) {
      input.refillEpPending = false
      player.ep = player.maxEp
    } // end if EP refill requested

    if (input.refillHpPending) {
      input.refillHpPending = false
      player.hp = player.maxHp
    } // end if HP refill requested

    const pendingManualPing = input.sonarPingPending
    input.sonarPingPending = false
    const shouldTriggerManualPing = pendingManualPing && !player.isFlying

    if (input.spawnTankPending) {
      input.spawnTankPending = false
      spawnRandomEnemy(combatWorld, collisionWorld, player, 'tank')
    } // end if spawn tank pending

    if (input.spawnStrikerPending) {
      input.spawnStrikerPending = false
      spawnRandomEnemy(combatWorld, collisionWorld, player, 'striker')
    } // end if spawn striker pending

    if (input.spawnBrutePending) {
      input.spawnBrutePending = false
      spawnRandomEnemy(combatWorld, collisionWorld, player, 'brute')
    } // end if spawn brute pending

    if (input.spawnHelicopterPending) {
      input.spawnHelicopterPending = false
      spawnRandomEnemy(combatWorld, collisionWorld, player, 'helicopter')
    } // end if spawn helicopter pending

    if (input.spawnBruiserPending) {
      input.spawnBruiserPending = false
      spawnRandomEnemy(combatWorld, collisionWorld, player, 'bruiser')
    } // end if spawn bruiser pending

    if (input.spawnTestDummyPending) {
      input.spawnTestDummyPending = false
      spawnEnemyCloseInFront(combatWorld, collisionWorld, player, 'test-dummy')
    } // end if spawn test dummy pending

    if (devAiEnabled) {
      stepCombatEcsWorld(combatWorld, collisionWorld, audio, player, deltaSeconds)
    }
    if (player.hp < hpBeforeCombat) {
      audio.playPlayerHealthStatusTone(player.hp / Math.max(1, player.maxHp))
      devLastDamageAmount = hpBeforeCombat - player.hp
      devLastDamageType = 'incoming'
      devLastHitLocation = 'front armor'
      devLastHeatGain = devLastDamageAmount * 0.1 * devHeatMultiplier
      devCurrentHeat = Math.min(devMaxHeat, devCurrentHeat + devLastHeatGain)
      nextEventTag(`Player took ${devLastDamageAmount.toFixed(1)} incoming damage`)
    } // end if player took damage this frame

    const combatCounts = getCombatEntityCounts(combatWorld)
    devEnemyCount = combatCounts.enemies
    devProjectileCount = combatCounts.projectiles

    devTimers.set('player.fireCooldown', playerFireCooldownSeconds)
    devTimers.set('player.meleeCooldown', playerMeleeCooldownSeconds)
    devTimers.set('weapon.reload', isReloading ? 1 : 0)
    devTimers.set('missile.lockProgressMs', missileLockProgressMs)

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

    devTargetLockedId = lockUpdate.lockedTank?.id ?? null

    const missileRequiresLock = playerWeapon.weaponType === 'missile'
      && (playerWeapon.lockOnTimeMs > 0 || playerWeapon.trackingRating > 0)

    if (playerWeapon.weaponType === 'missile') {
      if (!missileRequiresLock) {
        missileLockProgressMs = 0
        missileLockTargetId = null
        missileLockConfirmed = false
        missileLockToneTimerSeconds = 0
      } else {
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
          if (missileLockToneTimerSeconds >= 1) {
            audio.playMissileLockTone()
            missileLockToneTimerSeconds = 0
          } // end if another lock-acquiring tone is due

          if (missileLockProgressMs >= Math.max(0, playerWeapon.lockOnTimeMs)) {
            missileLockConfirmed = true
            audio.playMissileLockConfirmTone()
          } // end if lock-on timer completed
        } // end if missile lock not yet confirmed
      } // end if missile lock candidate exists
      } // end if this missile weapon requires lock behavior
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

    if (!input.fireHeld) {
      hasPlayedEmptyClipForCurrentTriggerPull = false
    } // end if trigger is released

    if (shouldAttemptShot && !isReloading && playerFireCooldownSeconds <= 0) {
      if (playerWeapon.ammoInClip <= 0) {
        if (!hasPlayedEmptyClipForCurrentTriggerPull) {
          audio.fireGunshot(EMPTY_CLIP_SOUND_PATH)
          hasPlayedEmptyClipForCurrentTriggerPull = true
        } // end if empty clip sound has not played for this trigger pull
      } else {
      const playerSpeed = Math.hypot(player.x - previousPlayerX, player.y - previousPlayerY) / Math.max(deltaSeconds, 0.0001)
      const maxMoveSpeed = player.isFlying ? PLAYER_FLIGHT_SPEED : PLAYER_SPEED
      const speedFraction = Math.min(1, playerSpeed / maxMoveSpeed)

      if (playerWeapon.weaponType === 'missile') {
        const lockedTargetId = lockUpdate.lockedTank?.id ?? null
        if (missileRequiresLock && (!missileLockConfirmed || lockedTargetId === null)) {
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
              lockedTargetId,
              playerWeapon.damagePerShot,
              playerWeapon.bulletSpeed,
              playerWeapon.maxRange,
              playerWeapon.projectileSize,
              playerWeapon.trackingRating,
              playerWeapon.explosionRadius,
              playerWeapon.explosionDamage,
              playerWeapon.explosionSounds,
              playerWeapon.accuracy,
              speedFraction
            )
          } // end for each missile in shot
          playerWeapon.ammoInClip = Math.max(0, playerWeapon.ammoInClip - 1)
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
            lockUpdate.lockedTank.height + PLAYER_HEIGHT,
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
        playerWeapon.ammoInClip = Math.max(0, playerWeapon.ammoInClip - 1)
      } // end if missile or ballistic firing mode
      } // end if weapon has ammo in clip
    } // end if fire input and cooldown allow

    if (input.meleePending) {
      input.meleePending = false
      if (!isReloading && equippedMeleeWeapon && playerMeleeCooldownSeconds <= 0) {
        const soundPath = equippedMeleeWeapon.swingSoundPaths[Math.floor(Math.random() * equippedMeleeWeapon.swingSoundPaths.length)]
          ?? equippedMeleeWeapon.swingSoundPaths[0]
        if (soundPath) {
          audio.fireGunshot(soundPath)
        } // end if melee swing sound available
        playerMeleeCooldownSeconds = equippedMeleeWeapon.meleeCooldownSeconds
        performPlayerMeleeAttack(
          combatWorld,
          audio,
          player,
          equippedMeleeWeapon.damagePerSwing,
          equippedMeleeWeapon.reach,
          equippedMeleeWeapon.coneAngleDegrees
        )
      } // end if melee weapon is equipped and ready
    } // end if melee input was pressed

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
      height: tank.height,
      positionalLoopSound: tank.positionalLoopSound,
      loopSoundPauseIntervalMs: tank.loopSoundPauseIntervalMs,
      stopLoopSoundWhileStationary: tank.stopLoopSoundWhileStationary
    }))

    const destinationPoi = getDestinationPoi()
    audio.updateNavigationDestinationCue(playerAudioState, destinationPoi?.position ?? null)

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
      const rateOfFireLabel = playerWeapon.fireRateCooldownSeconds > 0
        ? `${(1 / playerWeapon.fireRateCooldownSeconds).toFixed(2)}/s`
        : 'Unlimited'
      const meleeName = equippedMeleeWeapon?.name ?? 'None'
      const meleeDamage = equippedMeleeWeapon?.damagePerSwing ?? 0
      const meleeRate = equippedMeleeWeapon?.meleeCooldownSeconds
      const meleeRange = equippedMeleeWeapon?.reach ?? 0
      if (awarenessWeaponNameElement) awarenessWeaponNameElement.textContent = `${playerWeapon.name} | R: ${meleeName}`
      if (awarenessWeaponTypeElement) awarenessWeaponTypeElement.textContent = `${playerWeapon.weaponType} | clip ${playerWeapon.ammoInClip}/${playerWeapon.clipSize}`
      if (awarenessWeaponDamageElement) awarenessWeaponDamageElement.textContent = `${playerWeapon.damagePerShot} | ${meleeDamage}`
      if (awarenessWeaponRateElement) awarenessWeaponRateElement.textContent = `${rateOfFireLabel} | ${isReloading ? 'Reloading...' : `${meleeRate?.toFixed(2) ?? '0.00'}s`}`
      if (awarenessWeaponRangeElement) awarenessWeaponRangeElement.textContent = `${playerWeapon.maxRange.toFixed(1)} | ${meleeRange.toFixed(1)}`
      if (awarenessWeaponProjectilesElement) awarenessWeaponProjectilesElement.textContent = `${playerWeapon.projectileCount} | reload ${getWeaponReloadCost(playerWeapon)}`
      if (awarenessWeaponSpreadElement) awarenessWeaponSpreadElement.textContent = `${playerWeapon.spreadDegrees.toFixed(1)}°`
      if (awarenessWeaponAccuracyElement) awarenessWeaponAccuracyElement.textContent = `${(playerWeapon.accuracy * 100).toFixed(1)}%`
    } // end if weapon info element exists

    if (sonarStatusElement) {
      const centered = mapToCenteredCoordinates(player.x, player.y)
      const destinationLabel = destinationPoi
        ? `${destinationPoi.name}, ${Math.hypot(destinationPoi.position.x - player.x, destinationPoi.position.y - player.y).toFixed(1)}`
        : 'None'
      if (sonarCoordinatesElement) sonarCoordinatesElement.textContent = `X ${centered.x.toFixed(1)}, Y ${centered.y.toFixed(1)}`
      if (sonarRadarRangeElement) sonarRadarRangeElement.textContent = AUDIO_NAVIGATION_CONFIG.radarDetectionRange.toFixed(0)
      if (sonarDestinationElement) sonarDestinationElement.textContent = destinationLabel
    } // end if coordinate/radar/destination element exists

    const hpPercent = Math.max(0, Math.min(100, Math.round((player.hp / Math.max(1, player.maxHp)) * 100)))
    const epPercent = Math.max(0, Math.min(100, Math.round((player.ep / Math.max(1, player.maxEp)) * 100)))
    if (playerNameElement) {
      playerNameElement.textContent = player.name
    } // end if player name element exists
    if (hpBarLabelElement) {
      hpBarLabelElement.textContent = `${Math.round(player.hp)} / ${Math.round(player.maxHp)}`
    } // end if HP label element exists
    if (epBarLabelElement) {
      epBarLabelElement.textContent = `${Math.round(player.ep)} / ${Math.round(player.maxEp)}`
    } // end if EP label element exists
    if (ammoResourceLabelElement) {
      ammoResourceLabelElement.textContent = `${Math.round(universalAmmoResource)} | clip ${playerWeapon.ammoInClip}/${playerWeapon.clipSize}${isReloading ? ' | RELOADING' : ''}`
    } // end if universal ammo label exists
    if (hpBarFillElement instanceof HTMLElement) {
      hpBarFillElement.style.width = `${hpPercent}%`
    } // end if HP fill element exists
    if (epBarFillElement instanceof HTMLElement) {
      epBarFillElement.style.width = `${epPercent}%`
    } // end if EP fill element exists

    updateRuntimeDebugOverlay()

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
