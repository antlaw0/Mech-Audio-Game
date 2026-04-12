import * as Tone from 'tone'
import audioConfig from '../config/audioConfig.json'
import type { EnemyState } from '../core/worldTypes.js'
import { clamp, remap } from '../utils/mathUtils.js'

export type EnemyCueType =
  | 'spawn'
  | 'los-enter'
  | 'los-lost'
  | 'fire'
  | 'hit'
  | 'destroyed'
  | 'cover-enter'
  | 'cover-leave'

interface EnemyCueRuntime {
  oneShotSynth: Tone.Synth
  trackingSynth: Tone.Synth
  inCover: boolean
}

interface EnemySampleProfile {
  fireSound: string
  loadSound: string | null
  hitSound: string
  deathSound: string
}

interface SamplePool {
  voices: Tone.Player[]
  cursor: number
}

export class EnemyCues {
  private readonly runtimes = new Map<string, EnemyCueRuntime>()
  private readonly sampleProfiles = new Map<string, EnemySampleProfile>()
  private readonly samplePools = new Map<string, SamplePool>()

  constructor(private readonly log: (message: string) => void) {}

  registerEnemy(enemy: EnemyState): void {
    this.sampleProfiles.set(enemy.id, {
      fireSound: enemy.fireSound,
      loadSound: enemy.loadSound,
      hitSound: enemy.hitSound,
      deathSound: enemy.deathSound
    })

    this.primeSample(enemy.fireSound)
    this.primeSample(enemy.hitSound)
    this.primeSample(enemy.deathSound)
    if (enemy.loadSound) {
      this.primeSample(enemy.loadSound)
    }
  }

  playEnemyCue(enemyId: string, cueType: EnemyCueType): void {
    const runtime = this.getOrCreate(enemyId)
    const profile = this.sampleProfiles.get(enemyId)

    if (cueType === 'spawn') {
      if (profile?.loadSound) {
        this.playSample(profile.loadSound)
      }
      this.log(`[audio] enemy=${enemyId} spawned`)
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
      if (profile) {
        this.playSample(profile.fireSound)
      } else {
        runtime.oneShotSynth.triggerAttackRelease(320, '32n')
      }
      this.log(`[audio] enemy=${enemyId} fired`)
      return
    }

    if (cueType === 'hit') {
      if (profile) {
        this.playSample(profile.hitSound)
      } else {
        runtime.oneShotSynth.triggerAttackRelease(150, '32n')
      }
      this.log(`[audio] enemy=${enemyId} hit`)
      return
    }

    if (cueType === 'destroyed') {
      if (profile) {
        this.playSample(profile.deathSound)
      } else {
        runtime.oneShotSynth.triggerAttackRelease(90, '8n')
      }
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

    const oneShotSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
    }).toDestination()

    const trackingSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 }
    }).toDestination()

    const created: EnemyCueRuntime = {
      oneShotSynth,
      trackingSynth,
      inCover: false
    }

    this.runtimes.set(enemyId, created)
    return created
  }

  playSample(audioFile: string): void {
    const pool = this.getOrCreateSamplePool(audioFile)
    for (let offset = 0; offset < pool.voices.length; offset += 1) {
      const index = (pool.cursor + offset) % pool.voices.length
      const voice = pool.voices[index]
      if (!voice) {
        continue
      }
      if (!voice.loaded || voice.state === 'started') {
        continue
      }

      voice.start()
      pool.cursor = (index + 1) % pool.voices.length
      return
    }
  }

  private primeSample(audioFile: string): void {
    this.getOrCreateSamplePool(audioFile)
  }

  private getOrCreateSamplePool(audioFile: string): SamplePool {
    const existing = this.samplePools.get(audioFile)
    if (existing) {
      return existing
    }

    const gain = new Tone.Gain(audioConfig.enemyVolume).toDestination()
    const voices = Array.from({ length: 3 }, () => new Tone.Player(audioFile).connect(gain))
    const created: SamplePool = {
      voices,
      cursor: 0
    }

    this.samplePools.set(audioFile, created)
    return created
  }
}
