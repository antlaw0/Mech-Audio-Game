import * as ResonanceAudioImport from 'resonance-audio'

export interface SpatialDirectivity {
  alpha: number
  sharpness: number
}

export interface SpatialEmitterOptions {
  id?: string
  gain?: number
  minDistance?: number
  maxDistance?: number
  directivity?: SpatialDirectivity
  positionSmoothing?: number
  onPlay?: () => void
  onStop?: () => void
  onDispose?: () => void
}

export interface SpatialListenerPose {
  position: {
    x: number
    y: number
    z: number
  }
  orientation: {
    forwardX: number
    forwardY: number
    forwardZ: number
    upX: number
    upY: number
    upZ: number
  }
}

export interface FrontBackSpatialEnhancementSettings {
  enabled: boolean
  rearCueLayerEnabled: boolean
  intensity: number
  debugLogging: boolean
  debugFrameInterval: number
}

export interface FrontBackSpatialDiagnostics {
  emitterId: string
  distance: number
  behindSigned: number
  behindAmount: number
  targetBehindAmount: number
  turnBoost: number
  lowpassHz: number
  rearDiffuseGain: number
  rearReflectionGain: number
  rearWidthGain: number
  enhancementEnabled: boolean
  rearCueLayerEnabled: boolean
}

interface ResonanceSource {
  input: AudioNode
  setPosition(x: number, y: number, z: number): void
  setOrientation(forwardX: number, forwardY: number, forwardZ: number, upX: number, upY: number, upZ: number): void
  setGain(gain: number): void
  setMinDistance(distance: number): void
  setMaxDistance(distance: number): void
  setDirectivityPattern(alpha: number, sharpness: number): void
}

interface ResonanceScene {
  output: AudioNode
  createSource(): ResonanceSource
  setListenerPosition(x: number, y: number, z: number): void
  setListenerOrientation(forwardX: number, forwardY: number, forwardZ: number, upX: number, upY: number, upZ: number): void
}

type ResonanceAudioConstructor = new (audioContext: AudioContext, options?: { ambisonicOrder?: number }) => ResonanceScene

interface Vec3 {
  x: number
  y: number
  z: number
}

const WORLD_Y_TO_AUDIO_Z_SIGN = 1
const USE_LISTENER_RELATIVE_POSITIONING = true

type PositionTransform = (x: number, y: number, z: number, out: Vec3) => void

function mapWorldToAudioPoint(out: Vec3, x: number, y: number, z: number): void {
  out.x = x
  out.y = z
  out.z = y * WORLD_Y_TO_AUDIO_Z_SIGN
}

function mapWorldToAudioVector(out: Vec3, x: number, y: number, z: number): void {
  out.x = x
  out.y = z
  out.z = y * WORLD_Y_TO_AUDIO_Z_SIGN
}

interface SpatialSceneSingletonStore {
  instance: SharedSpatialAudioScene | null
  context: AudioContext | null
  creationCount: number
}

const FLOAT_EPSILON = 0.0001
const LISTENER_DEBUG_FRAME_INTERVAL_DEFAULT = 30
const SPATIAL_SCENE_SINGLETON_KEY = '__MECH_AUDIO_RESONANCE_SCENE_SINGLETON__'

const FRONT_BACK_DEFAULT_REAR_ANGLE_START = 0.08
const FRONT_BACK_DEFAULT_REAR_ANGLE_END = 0.9
const FRONT_BACK_DEFAULT_REAR_LOW_PASS_FRONT_HZ = 18000
const FRONT_BACK_DEFAULT_REAR_LOW_PASS_BACK_HZ = 7600
const FRONT_BACK_DEFAULT_REAR_DIFFUSE_GAIN = 0.18
const FRONT_BACK_DEFAULT_REAR_DIRECT_GAIN_REDUCTION = 0.1
const FRONT_BACK_DEFAULT_REAR_REFLECTION_SECONDS = 0.007
const FRONT_BACK_DEFAULT_REAR_REFLECTION_GAIN = 0.085
const FRONT_BACK_DEFAULT_REAR_WIDTH_SECONDS = 0.0018
const FRONT_BACK_DEFAULT_REAR_WIDTH_GAIN = 0.05
const FRONT_BACK_DEFAULT_REAR_TURN_BOOST = 0.22
const FRONT_BACK_DEFAULT_REAR_SMOOTHING = 0.18

interface FrontBackEnhancementConfigInternal {
  enabled: boolean
  rearCueLayerEnabled: boolean
  intensity: number
  debugLogging: boolean
  debugFrameInterval: number
  rearAngleStart: number
  rearAngleEnd: number
  rearLowPassFrontHz: number
  rearLowPassBackHz: number
  rearDiffuseGain: number
  rearDirectGainReduction: number
  rearReflectionSeconds: number
  rearReflectionGain: number
  rearWidthSeconds: number
  rearWidthGain: number
  rearTurnBoost: number
  rearSmoothing: number
}

interface FrontBackRuntimeState {
  config: FrontBackEnhancementConfigInternal
  turnBoost: number
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(1, Math.max(0, value))
}

function clampRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }
  return Math.min(max, Math.max(min, value))
}

function smoothstep01(value: number): number {
  const t = clamp01(value)
  return (t * t) * (3 - (2 * t))
}

function lerp(from: number, to: number, amount: number): number {
  return from + ((to - from) * amount)
}

function defaultFrontBackConfig(): FrontBackEnhancementConfigInternal {
  return {
    enabled: true,
    rearCueLayerEnabled: true,
    intensity: 1,
    debugLogging: false,
    debugFrameInterval: LISTENER_DEBUG_FRAME_INTERVAL_DEFAULT,
    rearAngleStart: FRONT_BACK_DEFAULT_REAR_ANGLE_START,
    rearAngleEnd: FRONT_BACK_DEFAULT_REAR_ANGLE_END,
    rearLowPassFrontHz: FRONT_BACK_DEFAULT_REAR_LOW_PASS_FRONT_HZ,
    rearLowPassBackHz: FRONT_BACK_DEFAULT_REAR_LOW_PASS_BACK_HZ,
    rearDiffuseGain: FRONT_BACK_DEFAULT_REAR_DIFFUSE_GAIN,
    rearDirectGainReduction: FRONT_BACK_DEFAULT_REAR_DIRECT_GAIN_REDUCTION,
    rearReflectionSeconds: FRONT_BACK_DEFAULT_REAR_REFLECTION_SECONDS,
    rearReflectionGain: FRONT_BACK_DEFAULT_REAR_REFLECTION_GAIN,
    rearWidthSeconds: FRONT_BACK_DEFAULT_REAR_WIDTH_SECONDS,
    rearWidthGain: FRONT_BACK_DEFAULT_REAR_WIDTH_GAIN,
    rearTurnBoost: FRONT_BACK_DEFAULT_REAR_TURN_BOOST,
    rearSmoothing: FRONT_BACK_DEFAULT_REAR_SMOOTHING
  }
}

function hasMeaningfulDelta(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return true
  }
  return Math.abs(a - b) > FLOAT_EPSILON
}

function resolveResonanceAudioConstructor(): ResonanceAudioConstructor {
  const moduleShape = ResonanceAudioImport as unknown as Record<string, unknown>
  const defaultExport = moduleShape.default as Record<string, unknown> | undefined
  const globalShape = globalThis as unknown as Record<string, unknown>

  const candidates: unknown[] = [
    moduleShape.ResonanceAudio,
    moduleShape.default,
    defaultExport?.ResonanceAudio,
    defaultExport?.default,
    (defaultExport?.default as Record<string, unknown> | undefined)?.ResonanceAudio,
    globalShape.ResonanceAudio,
    ResonanceAudioImport as unknown
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'function') {
      return candidate as ResonanceAudioConstructor
    }
  }

  const availableTopLevelKeys = Object.keys(moduleShape).join(', ')
  const availableDefaultKeys = defaultExport ? Object.keys(defaultExport).join(', ') : ''
  throw new Error(
    `Unable to resolve ResonanceAudio constructor from module export. Top-level keys: [${availableTopLevelKeys}] Default keys: [${availableDefaultKeys}]`
  )
}

function resolveResonanceCompatibleContext(audioContext: AudioContext): AudioContext {
  const maybeWrapped = audioContext as unknown as {
    rawContext?: AudioContext
    _context?: AudioContext
    constructor?: typeof AudioContext
  }

  const nativeContext = maybeWrapped.rawContext ?? maybeWrapped._context
  if (nativeContext instanceof AudioContext) {
    return nativeContext
  }

  const constructorPatchTarget = window as unknown as {
    AudioContext?: typeof AudioContext
    webkitAudioContext?: typeof AudioContext
  }

  const wrappedCtor = maybeWrapped.constructor || constructorPatchTarget.AudioContext

  if (
    wrappedCtor &&
    constructorPatchTarget.AudioContext &&
    constructorPatchTarget.AudioContext !== wrappedCtor
  ) {
    constructorPatchTarget.AudioContext = wrappedCtor
    if (constructorPatchTarget.webkitAudioContext) {
      constructorPatchTarget.webkitAudioContext = wrappedCtor
    }
  }

  return audioContext
}

function getSceneStore(): SpatialSceneSingletonStore {
  const scope = globalThis as unknown as Record<string, unknown>
  const existing = scope[SPATIAL_SCENE_SINGLETON_KEY] as SpatialSceneSingletonStore | undefined
  if (existing) {
    return existing
  }
  const created: SpatialSceneSingletonStore = {
    instance: null,
    context: null,
    creationCount: 0
  }
  scope[SPATIAL_SCENE_SINGLETON_KEY] = created
  return created
}

function normalizeVec3(out: Vec3, x: number, y: number, z: number, fallback: Vec3): void {
  const mag = Math.hypot(x, y, z)
  if (mag <= FLOAT_EPSILON) {
    out.x = fallback.x
    out.y = fallback.y
    out.z = fallback.z
    return
  }
  const invMag = 1 / mag
  out.x = x * invMag
  out.y = y * invMag
  out.z = z * invMag
}

function crossTo(out: Vec3, a: Vec3, b: Vec3): void {
  out.x = a.y * b.z - a.z * b.y
  out.y = a.z * b.x - a.x * b.z
  out.z = a.x * b.y - a.y * b.x
}

export class SpatialAudioEmitter {
  readonly input: AudioNode

  private readonly source: ResonanceSource
  private readonly id: string
  private readonly onPlay?: () => void
  private readonly onStop?: () => void
  private readonly onDispose?: () => void
  private readonly positionSmoothing: number
  private readonly positionTransform?: PositionTransform
  private readonly frontBackRuntimeStateProvider?: () => FrontBackRuntimeState

  private readonly inputGainNode: GainNode
  private readonly directGainNode: GainNode
  private readonly rearFilterNode: BiquadFilterNode
  private readonly rearDiffuseGainNode: GainNode
  private readonly rearReflectionDelayNode: DelayNode
  private readonly rearReflectionFilterNode: BiquadFilterNode
  private readonly rearReflectionGainNode: GainNode
  private readonly rearWidthDelayNode: DelayNode
  private readonly rearWidthGainNode: GainNode

  private disposed = false
  private isPlaying = false

  private positionX = Number.NaN
  private positionY = Number.NaN
  private positionZ = Number.NaN
  private targetPositionX = Number.NaN
  private targetPositionY = Number.NaN
  private targetPositionZ = Number.NaN

  private orientationForwardX = Number.NaN
  private orientationForwardY = Number.NaN
  private orientationForwardZ = Number.NaN
  private orientationUpX = Number.NaN
  private orientationUpY = Number.NaN
  private orientationUpZ = Number.NaN

  private gain = Number.NaN
  private minDistance = Number.NaN
  private maxDistance = Number.NaN
  private directivityAlpha = Number.NaN
  private directivitySharpness = Number.NaN
  private readonly audioPositionTemp: Vec3 = { x: 0, y: 0, z: 0 }
  private readonly audioForwardTemp: Vec3 = { x: 1, y: 0, z: 0 }
  private readonly audioUpTemp: Vec3 = { x: 0, y: 1, z: 0 }

  private frontBackBehindAmount = 0
  private frontBackLastBehindAmount = -1
  private frontBackDiagnostics: FrontBackSpatialDiagnostics
  private frontBackDebugFrameCounter = 0

  constructor(
    source: ResonanceSource,
    options?: SpatialEmitterOptions,
    positionTransform?: PositionTransform,
    frontBackRuntimeStateProvider?: () => FrontBackRuntimeState
  ) {
    this.source = source
    this.id = options?.id ?? `spatial-emitter-${Math.random().toString(36).slice(2)}`
    this.onPlay = options?.onPlay
    this.onStop = options?.onStop
    this.onDispose = options?.onDispose
    this.positionTransform = positionTransform
    this.frontBackRuntimeStateProvider = frontBackRuntimeStateProvider
    this.positionSmoothing = Number.isFinite(options?.positionSmoothing)
      ? Math.min(1, Math.max(0, options?.positionSmoothing ?? 0.35))
      : 0.35

    const context = source.input.context
    this.inputGainNode = context.createGain()
    this.directGainNode = context.createGain()
    this.rearFilterNode = context.createBiquadFilter()
    this.rearFilterNode.type = 'lowpass'
    this.rearDiffuseGainNode = context.createGain()
    this.rearReflectionDelayNode = context.createDelay(0.05)
    this.rearReflectionFilterNode = context.createBiquadFilter()
    this.rearReflectionFilterNode.type = 'lowpass'
    this.rearReflectionGainNode = context.createGain()
    this.rearWidthDelayNode = context.createDelay(0.02)
    this.rearWidthGainNode = context.createGain()

    this.inputGainNode.connect(this.directGainNode)
    this.directGainNode.connect(source.input)

    this.inputGainNode.connect(this.rearFilterNode)
    this.rearFilterNode.connect(this.rearDiffuseGainNode)
    this.rearDiffuseGainNode.connect(source.input)

    this.inputGainNode.connect(this.rearReflectionDelayNode)
    this.rearReflectionDelayNode.connect(this.rearReflectionFilterNode)
    this.rearReflectionFilterNode.connect(this.rearReflectionGainNode)
    this.rearReflectionGainNode.connect(source.input)

    this.inputGainNode.connect(this.rearWidthDelayNode)
    this.rearWidthDelayNode.connect(this.rearWidthGainNode)
    this.rearWidthGainNode.connect(source.input)

    this.input = this.inputGainNode

    this.rearFilterNode.frequency.value = FRONT_BACK_DEFAULT_REAR_LOW_PASS_FRONT_HZ
    this.rearReflectionFilterNode.frequency.value = FRONT_BACK_DEFAULT_REAR_LOW_PASS_FRONT_HZ
    this.rearReflectionDelayNode.delayTime.value = FRONT_BACK_DEFAULT_REAR_REFLECTION_SECONDS
    this.rearWidthDelayNode.delayTime.value = FRONT_BACK_DEFAULT_REAR_WIDTH_SECONDS
    this.directGainNode.gain.value = 1
    this.rearDiffuseGainNode.gain.value = 0
    this.rearReflectionGainNode.gain.value = 0
    this.rearWidthGainNode.gain.value = 0

    this.frontBackDiagnostics = {
      emitterId: this.id,
      distance: 0,
      behindSigned: 0,
      behindAmount: 0,
      targetBehindAmount: 0,
      turnBoost: 0,
      lowpassHz: FRONT_BACK_DEFAULT_REAR_LOW_PASS_FRONT_HZ,
      rearDiffuseGain: 0,
      rearReflectionGain: 0,
      rearWidthGain: 0,
      enhancementEnabled: true,
      rearCueLayerEnabled: true
    }

    this.setGain(options?.gain ?? 1)
    this.setDistanceRange(options?.minDistance ?? 1, options?.maxDistance ?? 100)

    if (options?.directivity) {
      this.setDirectivity(options.directivity)
    }
  }

  setPosition(x: number, y: number, z: number): void {
    if (this.disposed) {
      return
    }

    const requiresTransformRefresh = this.positionTransform !== undefined

    if (
      !requiresTransformRefresh &&
      !hasMeaningfulDelta(this.targetPositionX, x) &&
      !hasMeaningfulDelta(this.targetPositionY, y) &&
      !hasMeaningfulDelta(this.targetPositionZ, z)
    ) {
      return
    }

    this.targetPositionX = x
    this.targetPositionY = y
    this.targetPositionZ = z

    if (!Number.isFinite(this.positionX) || !Number.isFinite(this.positionY) || !Number.isFinite(this.positionZ)) {
      this.positionX = x
      this.positionY = y
      this.positionZ = z
    } else {
      const smoothing = this.positionSmoothing
      this.positionX += (x - this.positionX) * smoothing
      this.positionY += (y - this.positionY) * smoothing
      this.positionZ += (z - this.positionZ) * smoothing
    }

    if (this.positionTransform) {
      this.positionTransform(this.positionX, this.positionY, this.positionZ, this.audioPositionTemp)
    } else {
      mapWorldToAudioPoint(this.audioPositionTemp, this.positionX, this.positionY, this.positionZ)
    }
    this.source.setPosition(this.audioPositionTemp.x, this.audioPositionTemp.y, this.audioPositionTemp.z)
    this.updateFrontBackEnhancementFromRelativePosition()
  }

  private updateFrontBackEnhancementFromRelativePosition(): void {
    const runtime = this.frontBackRuntimeStateProvider?.()
    const config = runtime?.config

    if (!runtime || !config || !config.enabled || config.intensity <= FLOAT_EPSILON) {
      if (this.frontBackLastBehindAmount < 0 || this.frontBackLastBehindAmount > FLOAT_EPSILON) {
        this.directGainNode.gain.value = 1
        this.rearFilterNode.frequency.value = FRONT_BACK_DEFAULT_REAR_LOW_PASS_FRONT_HZ
        this.rearDiffuseGainNode.gain.value = 0
        this.rearReflectionGainNode.gain.value = 0
        this.rearWidthGainNode.gain.value = 0
        this.frontBackBehindAmount = 0
        this.frontBackLastBehindAmount = 0
      }
      this.frontBackDiagnostics.distance = 0
      this.frontBackDiagnostics.behindSigned = 0
      this.frontBackDiagnostics.behindAmount = 0
      this.frontBackDiagnostics.targetBehindAmount = 0
      this.frontBackDiagnostics.turnBoost = runtime?.turnBoost ?? 0
      this.frontBackDiagnostics.lowpassHz = FRONT_BACK_DEFAULT_REAR_LOW_PASS_FRONT_HZ
      this.frontBackDiagnostics.rearDiffuseGain = 0
      this.frontBackDiagnostics.rearReflectionGain = 0
      this.frontBackDiagnostics.rearWidthGain = 0
      this.frontBackDiagnostics.enhancementEnabled = false
      this.frontBackDiagnostics.rearCueLayerEnabled = config?.rearCueLayerEnabled ?? false
      return
    }

    const distance = Math.hypot(this.audioPositionTemp.x, this.audioPositionTemp.y, this.audioPositionTemp.z)
    const behindSigned = distance > FLOAT_EPSILON ? (this.audioPositionTemp.z / distance) : 0
    const rearBlend = smoothstep01((behindSigned - config.rearAngleStart) / Math.max(FLOAT_EPSILON, config.rearAngleEnd - config.rearAngleStart))
    const turnBoost = clamp01(runtime.turnBoost * config.rearTurnBoost)
    const targetBehindAmount = clamp01((rearBlend + (turnBoost * rearBlend * 0.6)) * config.intensity)
    this.frontBackBehindAmount += (targetBehindAmount - this.frontBackBehindAmount) * clamp01(config.rearSmoothing)

    const directGain = 1 - (config.rearDirectGainReduction * this.frontBackBehindAmount)
    const lowPassHz = lerp(config.rearLowPassFrontHz, config.rearLowPassBackHz, this.frontBackBehindAmount)
    const diffuseGain = config.rearDiffuseGain * this.frontBackBehindAmount
    const reflectionGain = config.rearCueLayerEnabled ? (config.rearReflectionGain * this.frontBackBehindAmount) : 0
    const widthGain = config.rearCueLayerEnabled ? (config.rearWidthGain * this.frontBackBehindAmount) : 0

    this.directGainNode.gain.value = directGain
    this.rearFilterNode.frequency.value = lowPassHz
    this.rearReflectionFilterNode.frequency.value = lowPassHz
    this.rearReflectionDelayNode.delayTime.value = config.rearReflectionSeconds
    this.rearWidthDelayNode.delayTime.value = config.rearWidthSeconds
    this.rearDiffuseGainNode.gain.value = diffuseGain
    this.rearReflectionGainNode.gain.value = reflectionGain
    this.rearWidthGainNode.gain.value = widthGain

    this.frontBackLastBehindAmount = this.frontBackBehindAmount
    this.frontBackDiagnostics.distance = distance
    this.frontBackDiagnostics.behindSigned = behindSigned
    this.frontBackDiagnostics.behindAmount = this.frontBackBehindAmount
    this.frontBackDiagnostics.targetBehindAmount = targetBehindAmount
    this.frontBackDiagnostics.turnBoost = runtime.turnBoost
    this.frontBackDiagnostics.lowpassHz = lowPassHz
    this.frontBackDiagnostics.rearDiffuseGain = diffuseGain
    this.frontBackDiagnostics.rearReflectionGain = reflectionGain
    this.frontBackDiagnostics.rearWidthGain = widthGain
    this.frontBackDiagnostics.enhancementEnabled = true
    this.frontBackDiagnostics.rearCueLayerEnabled = config.rearCueLayerEnabled

    if (config.debugLogging) {
      this.frontBackDebugFrameCounter += 1
      if (this.frontBackDebugFrameCounter % config.debugFrameInterval === 0) {
        console.debug('[SpatialAudio] frontBack', {
          emitterId: this.id,
          behindSigned,
          behindAmount: this.frontBackBehindAmount,
          targetBehindAmount,
          turnBoost: runtime.turnBoost,
          lowpassHz: lowPassHz
        })
      }
    }
  }

  setOrientation(forwardX: number, forwardY: number, forwardZ: number, upX: number, upY: number, upZ: number): void {
    if (this.disposed) {
      return
    }
    if (
      !hasMeaningfulDelta(this.orientationForwardX, forwardX) &&
      !hasMeaningfulDelta(this.orientationForwardY, forwardY) &&
      !hasMeaningfulDelta(this.orientationForwardZ, forwardZ) &&
      !hasMeaningfulDelta(this.orientationUpX, upX) &&
      !hasMeaningfulDelta(this.orientationUpY, upY) &&
      !hasMeaningfulDelta(this.orientationUpZ, upZ)
    ) {
      return
    }

    this.orientationForwardX = forwardX
    this.orientationForwardY = forwardY
    this.orientationForwardZ = forwardZ
    this.orientationUpX = upX
    this.orientationUpY = upY
    this.orientationUpZ = upZ

    mapWorldToAudioVector(this.audioForwardTemp, forwardX, forwardY, forwardZ)
    mapWorldToAudioVector(this.audioUpTemp, upX, upY, upZ)
    this.source.setOrientation(
      this.audioForwardTemp.x,
      this.audioForwardTemp.y,
      this.audioForwardTemp.z,
      this.audioUpTemp.x,
      this.audioUpTemp.y,
      this.audioUpTemp.z
    )
  }

  setGain(gain: number): void {
    if (this.disposed) {
      return
    }
    const clamped = Number.isFinite(gain) ? Math.max(0, gain) : 0
    if (!hasMeaningfulDelta(this.gain, clamped)) {
      return
    }
    this.gain = clamped
    this.source.setGain(clamped)
  }

  setDistanceRange(minDistance: number, maxDistance: number): void {
    if (this.disposed) {
      return
    }

    const safeMin = Number.isFinite(minDistance) ? Math.max(0.1, minDistance) : 1
    const safeMax = Number.isFinite(maxDistance) ? Math.max(safeMin + 0.1, maxDistance) : Math.max(safeMin + 0.1, 100)

    if (hasMeaningfulDelta(this.minDistance, safeMin)) {
      this.minDistance = safeMin
      this.source.setMinDistance(safeMin)
    }

    if (hasMeaningfulDelta(this.maxDistance, safeMax)) {
      this.maxDistance = safeMax
      this.source.setMaxDistance(safeMax)
    }
  }

  setDirectivity(directivity: SpatialDirectivity): void {
    if (this.disposed) {
      return
    }

    const alpha = Number.isFinite(directivity.alpha) ? Math.min(1, Math.max(0, directivity.alpha)) : 0
    const sharpness = Number.isFinite(directivity.sharpness) ? Math.max(1, directivity.sharpness) : 1

    if (
      !hasMeaningfulDelta(this.directivityAlpha, alpha) &&
      !hasMeaningfulDelta(this.directivitySharpness, sharpness)
    ) {
      return
    }

    this.directivityAlpha = alpha
    this.directivitySharpness = sharpness
    this.source.setDirectivityPattern(alpha, sharpness)
  }

  play(): void {
    if (this.disposed || this.isPlaying) {
      return
    }
    this.isPlaying = true
    this.onPlay?.()
  }

  stop(): void {
    if (this.disposed || !this.isPlaying) {
      return
    }
    this.isPlaying = false
    this.onStop?.()
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.stop()
    this.disposed = true
    this.onDispose?.()
  }

  getEmitterId(): string {
    return this.id
  }

  isDisposed(): boolean {
    return this.disposed
  }

  getFrontBackDiagnostics(): FrontBackSpatialDiagnostics {
    return this.frontBackDiagnostics
  }
}

export class SharedSpatialAudioScene {
  private readonly scene: ResonanceScene
  private readonly managedEmitters = new Map<string, SpatialAudioEmitter>()
  private emitterIdCounter = 0
  private readonly frontBackRuntimeState: FrontBackRuntimeState = {
    config: defaultFrontBackConfig(),
    turnBoost: 0
  }

  private listenerWorldX = 0
  private listenerWorldY = 0
  private listenerWorldZ = 0
  private listenerWorldYaw = 0
  private listenerRelativeInitialized = false
  private listenerLastYawRadians = 0
  private listenerLastUpdateTimeMs = 0

  private listenerPosX = Number.NaN
  private listenerPosY = Number.NaN
  private listenerPosZ = Number.NaN
  private listenerForwardX = Number.NaN
  private listenerForwardY = Number.NaN
  private listenerForwardZ = Number.NaN
  private listenerUpX = Number.NaN
  private listenerUpY = Number.NaN
  private listenerUpZ = Number.NaN

  private readonly listenerWorldForwardTemp: Vec3 = { x: 1, y: 0, z: 0 }
  private readonly listenerWorldUpTemp: Vec3 = { x: 0, y: 0, z: 1 }
  private readonly listenerAudioPositionTemp: Vec3 = { x: 0, y: 0, z: 0 }
  private readonly listenerForwardTemp: Vec3 = { x: 1, y: 0, z: 0 }
  private readonly listenerUpTemp: Vec3 = { x: 0, y: 1, z: 0 }
  private readonly listenerRightTemp: Vec3 = { x: 0, y: 0, z: 1 }

  private listenerDebugEnabled = false
  private listenerDebugFrameInterval = LISTENER_DEBUG_FRAME_INTERVAL_DEFAULT
  private listenerDebugFrameCounter = 0

  constructor(audioContext: AudioContext) {
    const compatibleContext = resolveResonanceCompatibleContext(audioContext)
    const ResonanceAudioCtor = resolveResonanceAudioConstructor()
    this.scene = new ResonanceAudioCtor(compatibleContext, {
      ambisonicOrder: 1
    })

    // Signal flow:
    // Tone source -> SpatialAudioEmitter.input -> Resonance source -> shared ambisonic scene -> AudioContext destination.
    this.scene.output.connect(compatibleContext.destination)

    if (USE_LISTENER_RELATIVE_POSITIONING) {
      this.scene.setListenerPosition(0, 0, 0)
      this.scene.setListenerOrientation(0, 0, -1, 0, 1, 0)
      this.listenerRelativeInitialized = true
    }

    const nowMs = performance.now()
    this.listenerLastUpdateTimeMs = nowMs
  }

  private transformWorldPointToListenerRelativeAudioSpace(x: number, y: number, z: number, out: Vec3): void {
    const dx = x - this.listenerWorldX
    const dy = y - this.listenerWorldY
    const dz = z - this.listenerWorldZ

    const yaw = this.listenerWorldYaw
    const sinYaw = Math.sin(yaw)
    const cosYaw = Math.cos(yaw)

    const right = (dx * -sinYaw) + (dy * cosYaw)
    const forward = (dx * cosYaw) + (dy * sinYaw)

    out.x = right
    out.y = dz
    out.z = -forward
  }

  createEmitter(options?: SpatialEmitterOptions): SpatialAudioEmitter {
    let emitterId = options?.id
    if (!emitterId) {
      do {
        this.emitterIdCounter += 1
        emitterId = `spatial-emitter-${this.emitterIdCounter}`
      } while (this.managedEmitters.has(emitterId))
    }

    if (this.managedEmitters.has(emitterId)) {
      throw new Error(`SpatialAudioEmitter duplicate id detected: ${emitterId}`)
    }

    const source = this.scene.createSource()
    const emitter = new SpatialAudioEmitter(source, {
      ...options,
      id: emitterId,
      onDispose: () => {
        this.managedEmitters.delete(emitterId)
        options?.onDispose?.()
      }
    }, USE_LISTENER_RELATIVE_POSITIONING
      ? (x: number, y: number, z: number, out: Vec3) => this.transformWorldPointToListenerRelativeAudioSpace(x, y, z, out)
      : undefined,
    () => this.frontBackRuntimeState)

    this.managedEmitters.set(emitterId, emitter)
    return emitter
  }

  setListenerDebugLogging(enabled: boolean, frameInterval: number = LISTENER_DEBUG_FRAME_INTERVAL_DEFAULT): void {
    this.listenerDebugEnabled = enabled
    this.listenerDebugFrameInterval = Math.max(1, Math.floor(frameInterval))
  }

  updateListenerFromCamera(pose: SpatialListenerPose): void {
    const nowMs = performance.now()
    const dtSeconds = Math.max(0.001, (nowMs - this.listenerLastUpdateTimeMs) / 1000)
    const yaw = Math.atan2(pose.orientation.forwardY, pose.orientation.forwardX)
    const yawDelta = Math.atan2(Math.sin(yaw - this.listenerLastYawRadians), Math.cos(yaw - this.listenerLastYawRadians))
    const yawVelocity = yawDelta / dtSeconds
    this.frontBackRuntimeState.turnBoost = clamp01(Math.abs(yawVelocity) / 3.2)

    this.listenerWorldX = pose.position.x
    this.listenerWorldY = pose.position.y
    this.listenerWorldZ = pose.position.z
    this.listenerWorldYaw = yaw

    this.listenerLastYawRadians = yaw
    this.listenerLastUpdateTimeMs = nowMs

    if (USE_LISTENER_RELATIVE_POSITIONING) {
      if (!this.listenerRelativeInitialized) {
        this.scene.setListenerPosition(0, 0, 0)
        this.scene.setListenerOrientation(0, 0, -1, 0, 1, 0)
        this.listenerRelativeInitialized = true
      }
      return
    }

    normalizeVec3(
      this.listenerWorldForwardTemp,
      pose.orientation.forwardX,
      pose.orientation.forwardY,
      pose.orientation.forwardZ,
      { x: 1, y: 0, z: 0 }
    )

    normalizeVec3(
      this.listenerWorldUpTemp,
      pose.orientation.upX,
      pose.orientation.upY,
      pose.orientation.upZ,
      { x: 0, y: 0, z: 1 }
    )

    mapWorldToAudioPoint(this.listenerAudioPositionTemp, pose.position.x, pose.position.y, pose.position.z)
    mapWorldToAudioVector(
      this.listenerForwardTemp,
      this.listenerWorldForwardTemp.x,
      this.listenerWorldForwardTemp.y,
      this.listenerWorldForwardTemp.z
    )
    mapWorldToAudioVector(
      this.listenerUpTemp,
      this.listenerWorldUpTemp.x,
      this.listenerWorldUpTemp.y,
      this.listenerWorldUpTemp.z
    )

    crossTo(this.listenerRightTemp, this.listenerForwardTemp, this.listenerUpTemp)
    normalizeVec3(this.listenerRightTemp, this.listenerRightTemp.x, this.listenerRightTemp.y, this.listenerRightTemp.z, { x: 0, y: 0, z: 1 })

    crossTo(this.listenerUpTemp, this.listenerRightTemp, this.listenerForwardTemp)
    normalizeVec3(this.listenerUpTemp, this.listenerUpTemp.x, this.listenerUpTemp.y, this.listenerUpTemp.z, { x: 0, y: 1, z: 0 })

    if (
      hasMeaningfulDelta(this.listenerPosX, this.listenerAudioPositionTemp.x) ||
      hasMeaningfulDelta(this.listenerPosY, this.listenerAudioPositionTemp.y) ||
      hasMeaningfulDelta(this.listenerPosZ, this.listenerAudioPositionTemp.z)
    ) {
      this.listenerPosX = this.listenerAudioPositionTemp.x
      this.listenerPosY = this.listenerAudioPositionTemp.y
      this.listenerPosZ = this.listenerAudioPositionTemp.z
      this.scene.setListenerPosition(this.listenerPosX, this.listenerPosY, this.listenerPosZ)
    }

    if (
      hasMeaningfulDelta(this.listenerForwardX, this.listenerForwardTemp.x) ||
      hasMeaningfulDelta(this.listenerForwardY, this.listenerForwardTemp.y) ||
      hasMeaningfulDelta(this.listenerForwardZ, this.listenerForwardTemp.z) ||
      hasMeaningfulDelta(this.listenerUpX, this.listenerUpTemp.x) ||
      hasMeaningfulDelta(this.listenerUpY, this.listenerUpTemp.y) ||
      hasMeaningfulDelta(this.listenerUpZ, this.listenerUpTemp.z)
    ) {
      this.listenerForwardX = this.listenerForwardTemp.x
      this.listenerForwardY = this.listenerForwardTemp.y
      this.listenerForwardZ = this.listenerForwardTemp.z
      this.listenerUpX = this.listenerUpTemp.x
      this.listenerUpY = this.listenerUpTemp.y
      this.listenerUpZ = this.listenerUpTemp.z

      this.scene.setListenerOrientation(
        this.listenerForwardX,
        this.listenerForwardY,
        this.listenerForwardZ,
        this.listenerUpX,
        this.listenerUpY,
        this.listenerUpZ
      )
    }

    if (this.listenerDebugEnabled) {
      this.listenerDebugFrameCounter += 1
      if (this.listenerDebugFrameCounter % this.listenerDebugFrameInterval === 0) {
        console.debug('[SpatialAudio] listener', {
          position: { x: this.listenerPosX, y: this.listenerPosY, z: this.listenerPosZ },
          forward: { x: this.listenerForwardX, y: this.listenerForwardY, z: this.listenerForwardZ },
          up: { x: this.listenerUpX, y: this.listenerUpY, z: this.listenerUpZ },
          right: {
            x: this.listenerRightTemp.x,
            y: this.listenerRightTemp.y,
            z: this.listenerRightTemp.z
          },
          yawRadians: this.listenerWorldYaw,
          frontBackTurnBoost: this.frontBackRuntimeState.turnBoost
        })
      }
    }
  }

  setFrontBackEnhancementEnabled(enabled: boolean): void {
    this.frontBackRuntimeState.config.enabled = enabled
  }

  isFrontBackEnhancementEnabled(): boolean {
    return this.frontBackRuntimeState.config.enabled
  }

  setFrontBackRearCueLayerEnabled(enabled: boolean): void {
    this.frontBackRuntimeState.config.rearCueLayerEnabled = enabled
  }

  isFrontBackRearCueLayerEnabled(): boolean {
    return this.frontBackRuntimeState.config.rearCueLayerEnabled
  }

  setFrontBackEnhancementIntensity(intensity: number): void {
    this.frontBackRuntimeState.config.intensity = clampRange(intensity, 0, 1.8)
  }

  getFrontBackEnhancementIntensity(): number {
    return this.frontBackRuntimeState.config.intensity
  }

  setFrontBackDebugLogging(enabled: boolean, frameInterval: number = LISTENER_DEBUG_FRAME_INTERVAL_DEFAULT): void {
    this.frontBackRuntimeState.config.debugLogging = enabled
    this.frontBackRuntimeState.config.debugFrameInterval = Math.max(1, Math.floor(frameInterval))
  }

  getFrontBackSettings(): FrontBackSpatialEnhancementSettings {
    return {
      enabled: this.frontBackRuntimeState.config.enabled,
      rearCueLayerEnabled: this.frontBackRuntimeState.config.rearCueLayerEnabled,
      intensity: this.frontBackRuntimeState.config.intensity,
      debugLogging: this.frontBackRuntimeState.config.debugLogging,
      debugFrameInterval: this.frontBackRuntimeState.config.debugFrameInterval
    }
  }

  getFrontBackDiagnostics(emitterId: string): FrontBackSpatialDiagnostics | null {
    const emitter = this.managedEmitters.get(emitterId)
    if (!emitter || emitter.isDisposed()) {
      return null
    }
    return emitter.getFrontBackDiagnostics()
  }

  getAllFrontBackDiagnostics(): FrontBackSpatialDiagnostics[] {
    const diagnostics: FrontBackSpatialDiagnostics[] = []
    for (const emitter of this.managedEmitters.values()) {
      if (!emitter.isDisposed()) {
        diagnostics.push(emitter.getFrontBackDiagnostics())
      }
    }
    return diagnostics
  }

  assertNoOrphanEmitters(): void {
    for (const emitter of this.managedEmitters.values()) {
      if (emitter.isDisposed()) {
        throw new Error('SpatialAudio scene contains a disposed emitter reference.')
      }
    }
  }
}

export function createSharedSpatialAudioScene(audioContext: AudioContext): SharedSpatialAudioScene {
  const store = getSceneStore()

  if (store.instance) {
    if (store.context !== audioContext) {
      throw new Error('Multiple ResonanceAudio scenes detected with different audio contexts.')
    }
    return store.instance
  }

  const instance = new SharedSpatialAudioScene(audioContext)
  store.instance = instance
  store.context = audioContext
  store.creationCount += 1

  if (store.creationCount > 1) {
    throw new Error('Multiple ResonanceAudio scene creation attempts detected.')
  }

  return instance
}
