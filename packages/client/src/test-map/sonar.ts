import * as Tone from 'tone'
import { MAP_HEIGHT, MAP_WIDTH } from './constants.js'

const DEG_TO_RAD = Math.PI / 180
const SONAR_SWEEP_MIN_DEG = -45
const SONAR_SWEEP_MAX_DEG = 45
const SONAR_UPDATE_INTERVAL_MS = 20
const RAY_STEP_UNITS = 0.15
const DEFAULT_MAX_RAY_DISTANCE = 30
const OSCILLATOR_FREQUENCY = 1200
const MIN_VOLUME_DB = -30
const VOLUME_DB_SPAN = 20
const FILTER_BASE_CUTOFF = 1000
const FILTER_CUTOFF_SPAN = 8000

export interface SonarPlayer {
  x: number
  y: number
  facing: number
} // end interface SonarPlayer

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
} // end function clamp

function angleDegreesToRadians(angleDeg: number): number {
  return angleDeg * DEG_TO_RAD
} // end function angleDegreesToRadians

function isWall(mapData: Uint8Array, worldX: number, worldY: number): boolean {
  const col = Math.floor(worldX)
  const row = Math.floor(worldY)
  if (col < 0 || col >= MAP_WIDTH || row < 0 || row >= MAP_HEIGHT) {
    return true
  } // end if point outside map bounds

  return mapData[row * MAP_WIDTH + col] !== 0
} // end function isWall

function raycast(
  mapData: Uint8Array,
  originX: number,
  originY: number,
  angleDeg: number,
  maxDistance = DEFAULT_MAX_RAY_DISTANCE
): number {
  const angleRad = angleDegreesToRadians(angleDeg)
  const dirX = Math.cos(angleRad)
  const dirY = Math.sin(angleRad)

  for (let distance = 0; distance <= maxDistance; distance += RAY_STEP_UNITS) {
    const sampleX = originX + dirX * distance
    const sampleY = originY + dirY * distance
    if (isWall(mapData, sampleX, sampleY)) {
      return distance
    } // end if wall hit found
  } // end for each ray sample step

  return maxDistance
} // end function raycast

export class SweepingSonar {
  private readonly mapData: Uint8Array
  private readonly maxDistance: number
  private readonly oscillator: Tone.Oscillator
  private readonly filter: Tone.Filter
  private readonly panner: Tone.Panner
  private readonly gain: Tone.Gain
  private intervalId: number | null = null
  private enabled = false
  private sweepAngle = SONAR_SWEEP_MIN_DEG
  private sweepDirection: 1 | -1 = 1
  private readonly sweepSpeed: number
  private readonly player: SonarPlayer = { x: 0, y: 0, facing: 0 }

  constructor(mapData: Uint8Array, maxDistance = DEFAULT_MAX_RAY_DISTANCE, sweepSpeed = 3) {
    this.mapData = mapData
    this.maxDistance = maxDistance
    this.sweepSpeed = sweepSpeed

    this.oscillator = new Tone.Oscillator({
      frequency: OSCILLATOR_FREQUENCY,
      type: 'sine'
    })
    this.filter = new Tone.Filter({
      frequency: FILTER_BASE_CUTOFF,
      type: 'lowpass',
      rolloff: -12,
      Q: 0.6
    })
    this.panner = new Tone.Panner(0)
    this.gain = new Tone.Gain(Tone.dbToGain(MIN_VOLUME_DB))

    this.oscillator.connect(this.filter)
    this.filter.connect(this.panner)
    this.panner.connect(this.gain)
    this.gain.toDestination()
    this.oscillator.start()
  } // end constructor SweepingSonar

  async start(): Promise<void> {
    if (this.intervalId !== null) {
      return
    } // end if sonar loop already active

    if (Tone.getContext().state !== 'running') {
      try {
        await Tone.start()
      } catch {
        // Some browsers reject resume without a user gesture; update loop can still run silently.
      } // end try/catch Tone.start
    } // end if Tone context suspended

    this.intervalId = window.setInterval(() => {
      this.update()
    }, SONAR_UPDATE_INTERVAL_MS)
  } // end method start

  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    } // end if sonar loop exists

    this.gain.gain.rampTo(Tone.dbToGain(MIN_VOLUME_DB), 0.05)
  } // end method stop

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (enabled) {
      void this.start()
      return
    } // end if enabling sonar

    this.stop()
  } // end method setEnabled

  isEnabled(): boolean {
    return this.enabled
  } // end method isEnabled

  updatePlayerPosition(x: number, y: number, facingDeg: number): void {
    this.player.x = x
    this.player.y = y
    this.player.facing = facingDeg
  } // end method updatePlayerPosition

  update(): void {
    if (!this.enabled) {
      return
    } // end if sonar disabled

    this.sweepAngle += this.sweepSpeed * this.sweepDirection
    if (this.sweepAngle >= SONAR_SWEEP_MAX_DEG) {
      this.sweepAngle = SONAR_SWEEP_MAX_DEG
      this.sweepDirection = -1
    } // end if sweep hit max bound
    if (this.sweepAngle <= SONAR_SWEEP_MIN_DEG) {
      this.sweepAngle = SONAR_SWEEP_MIN_DEG
      this.sweepDirection = 1
    } // end if sweep hit min bound

    const worldAngle = this.player.facing + this.sweepAngle
    const distance = raycast(this.mapData, this.player.x, this.player.y, worldAngle, this.maxDistance)
    const closeness = 1 - clamp(distance / this.maxDistance, 0, 1)

    const volumeDb = MIN_VOLUME_DB + closeness * VOLUME_DB_SPAN
    const cutoff = FILTER_BASE_CUTOFF + closeness * FILTER_CUTOFF_SPAN
    const pan = clamp(this.sweepAngle / 45, -1, 1)

    this.gain.gain.rampTo(Tone.dbToGain(volumeDb), 0.03)
    this.filter.frequency.rampTo(cutoff, 0.03)
    this.panner.pan.rampTo(pan, 0.03)
  } // end method update

  dispose(): void {
    this.stop()
    this.enabled = false
    this.oscillator.stop()
    this.oscillator.dispose()
    this.filter.dispose()
    this.panner.dispose()
    this.gain.dispose()
  } // end method dispose
} // end class SweepingSonar

export function createSweepingSonar(mapData: Uint8Array, maxDistance = DEFAULT_MAX_RAY_DISTANCE): SweepingSonar {
  return new SweepingSonar(mapData, maxDistance)
} // end function createSweepingSonar
