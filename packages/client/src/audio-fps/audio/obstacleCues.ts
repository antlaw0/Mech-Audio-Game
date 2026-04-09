import * as Tone from 'tone'
import audioConfig from '../config/audioConfig.json'
import { obstacleWarningIntensity, type NearbyObstacle } from '../core/collision.js'
import { clamp } from '../utils/mathUtils.js'

export class ObstacleCues {
  private readonly synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.05 }
  }).toDestination()

  private cooldownSeconds = 0

  constructor(private readonly log: (message: string) => void) {}

  updateBackgroundCues(obstacles: NearbyObstacle[]): void {
    if (obstacles.length === 0) {
      this.cooldownSeconds = Math.max(0, this.cooldownSeconds - 1 / 60)
      return
    }

    this.cooldownSeconds = Math.max(0, this.cooldownSeconds - 1 / 60)
    const nearest = obstacles[0]!

    if (this.cooldownSeconds > 0) {
      return
    }

    this.playObstacleProximityCue(nearest.distance, nearest.direction)

    const intensity = obstacleWarningIntensity(
      nearest.distance,
      audioConfig.obstacleCueIntensity.nearDistance,
      audioConfig.obstacleCueIntensity.farDistance
    )
    this.cooldownSeconds =
      audioConfig.obstacleCueIntensity.maxRateSeconds -
      (audioConfig.obstacleCueIntensity.maxRateSeconds - audioConfig.obstacleCueIntensity.minRateSeconds) * intensity
  }

  playObstacleProximityCue(distance: number, direction: number): void {
    const intensity = obstacleWarningIntensity(
      distance,
      audioConfig.obstacleCueIntensity.nearDistance,
      audioConfig.obstacleCueIntensity.farDistance
    )
    const pan = clamp(direction / (Math.PI * 0.5), -1, 1)
    const frequency = 180 + intensity * 600
    this.synth.volume.value = Tone.gainToDb(Math.max(0.02, intensity * audioConfig.obstacleVolume))
    this.synth.detune.value = pan * 80
    this.synth.triggerAttackRelease(frequency, '32n')
    this.log(`[audio] obstacle cue distance=${distance.toFixed(2)} dir=${direction.toFixed(2)}`)
  }
}
