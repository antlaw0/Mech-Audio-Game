import * as Tone from 'tone'
import audioConfig from '../config/audioConfig.json'
import { clamp, normalizeAngle } from '../utils/mathUtils.js'
import type { NavigationPingHit } from '../core/worldTypes.js'

export type UIAudioName =
  | 'footstep'
  | 'weapon-fire'
  | 'reload'
  | 'health-alert'
  | 'objective-marker'
  | 'impact'
  | 'impact-heavy'
  | 'impact-light'

export class UIAudio {
  private readonly synth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
  }).toDestination()

  private readonly pingSynth = new Tone.FMSynth({
    harmonicity: 1.5,
    modulationIndex: 3,
    envelope: { attack: 0.002, decay: 0.14, sustain: 0, release: 0.07 }
  }).toDestination()

  constructor(private readonly log: (message: string) => void) {}

  playUI(audioName: UIAudioName): void {
    const map: Record<UIAudioName, number> = {
      footstep: 180,
      'weapon-fire': 280,
      reload: 220,
      'health-alert': 760,
      'objective-marker': 520,
      impact: 160,
      'impact-heavy': 120,
      'impact-light': 250
    }

    const frequency = map[audioName]
    this.synth.volume.value = Tone.gainToDb(audioConfig.uiVolume)
    this.synth.triggerAttackRelease(frequency, '16n')
    this.log(`[audio] ui cue=${audioName}`)
  }

  playCompassCue(directionAngle: number): void {
    const angle = normalizeAngle(directionAngle)
    const pan = clamp(angle / Math.PI, -1, 1)
    const frequency = 350 + (1 - Math.abs(pan)) * 260
    this.pingSynth.triggerAttackRelease(frequency, '8n')
    this.log(`[audio] compass cue angle=${angle.toFixed(2)}`)
  }

  playNavigationPing(resultData: NavigationPingHit[]): void {
    const now = Tone.now()
    resultData.forEach((hit, index) => {
      const materialOffset =
        hit.material === 'metal' ? 120 :
          hit.material === 'concrete' ? 50 :
            hit.material === 'foliage' ? -20 : -80
      const frequency = 180 + materialOffset + (1 - hit.distance / 18) * 420
      this.pingSynth.triggerAttackRelease(frequency, '32n', now + index * 0.05)
    })
    this.log(`[audio] navigation ping rays=${resultData.length}`)
  }
}
