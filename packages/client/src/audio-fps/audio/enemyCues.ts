import * as Tone from 'tone'
import audioConfig from '../config/audioConfig.json'
import { clamp, remap } from '../utils/mathUtils.js'

export type EnemyCueType =
  | 'move-loop'
  | 'los-enter'
  | 'los-lost'
  | 'fire'
  | 'destroyed'
  | 'cover-enter'
  | 'cover-leave'

interface EnemyCueRuntime {
  movementOsc: Tone.Oscillator
  movementGain: Tone.Gain
  oneShotSynth: Tone.Synth
  trackingSynth: Tone.Synth
  inCover: boolean
}

export class EnemyCues {
  private readonly runtimes = new Map<string, EnemyCueRuntime>()

  constructor(private readonly log: (message: string) => void) {}

  playEnemyCue(enemyId: string, cueType: EnemyCueType): void {
    const runtime = this.getOrCreate(enemyId)

    if (cueType === 'move-loop') {
      runtime.movementGain.gain.rampTo(0.08, 0.08)
      return
    }

    if (cueType === 'los-enter') {
      runtime.oneShotSynth.triggerAttackRelease(500, '16n')
      this.log(`[audio] enemy=${enemyId} line-of-sight enter`)
      return
    }

    if (cueType === 'los-lost') {
      runtime.oneShotSynth.triggerAttackRelease(180, '16n')
      this.log(`[audio] enemy=${enemyId} line-of-sight lost`)
      return
    }

    if (cueType === 'fire') {
      runtime.oneShotSynth.triggerAttackRelease(320, '32n')
      this.log(`[audio] enemy=${enemyId} fired`)
      return
    }

    if (cueType === 'destroyed') {
      runtime.oneShotSynth.triggerAttackRelease(90, '8n')
      runtime.movementGain.gain.rampTo(0, 0.2)
      this.log(`[audio] enemy=${enemyId} destroyed`)
      return
    }

    if (cueType === 'cover-enter') {
      runtime.oneShotSynth.triggerAttackRelease(210, '32n')
      runtime.inCover = true
      return
    }

    runtime.oneShotSynth.triggerAttackRelease(360, '32n')
    runtime.inCover = false
  }

  updateTrackingTone(relativeAngle: number, distance: number): void {
    const runtime = this.getOrCreate('tracking')
    const angleWeight = 1 - clamp(Math.abs(relativeAngle) / Math.PI, 0, 1)
    const distanceWeight = 1 - clamp(distance / 40, 0, 1)
    const blend = angleWeight * 0.7 + distanceWeight * 0.3

    const frequency = remap(
      blend,
      0,
      1,
      audioConfig.trackingTone.minFrequency,
      audioConfig.trackingTone.maxFrequency
    )

    runtime.trackingSynth.volume.value = Tone.gainToDb(Math.max(0.02, blend * 0.22))
    runtime.trackingSynth.detune.value = clamp(relativeAngle / Math.PI, -1, 1) * 80
    runtime.trackingSynth.triggerAttackRelease(frequency, '64n')

    if (Math.abs(relativeAngle) < 0.08 && distance < 14) {
      runtime.oneShotSynth.triggerAttackRelease(audioConfig.trackingTone.lockFrequency, '128n')
    }
  }

  playCoverChangeCue(enemyId: string, inCover: boolean): void {
    this.playEnemyCue(enemyId, inCover ? 'cover-enter' : 'cover-leave')
    this.log(`[audio] enemy=${enemyId} cover=${inCover}`)
  }

  private getOrCreate(enemyId: string): EnemyCueRuntime {
    const existing = this.runtimes.get(enemyId)
    if (existing) {
      return existing
    }

    const movementGain = new Tone.Gain(0).toDestination()
    const movementOsc = new Tone.Oscillator({ frequency: 140, type: 'sawtooth' }).connect(movementGain)
    movementOsc.start()

    const oneShotSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
    }).toDestination()

    const trackingSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 }
    }).toDestination()

    const created: EnemyCueRuntime = {
      movementOsc,
      movementGain,
      oneShotSynth,
      trackingSynth,
      inCover: false
    }

    this.runtimes.set(enemyId, created)
    return created
  }
}
