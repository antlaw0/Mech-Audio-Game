import * as Tone from 'tone'
import audioConfig from '../config/audioConfig.json'
import { clamp } from '../utils/mathUtils.js'
import type { Vec3 } from '../utils/vector.js'

export interface PositionalSourceState {
  id: string
  file: string
  loop: boolean
  position: Vec3
  velocity: Vec3
  active: boolean
}

interface SourceNode {
  state: PositionalSourceState
  panner: PannerNode
  gain: Tone.Gain
  player: Tone.Player
}

export class PositionalAudioEngine {
  private readonly context: AudioContext
  private readonly sources = new Map<string, SourceNode>()

  constructor(private readonly log: (message: string) => void) {
    this.context = Tone.getContext().rawContext as AudioContext
  }

  createPositionalSource(id: string, audioFile: string, loop: boolean, initialPosition: Vec3): void {
    if (this.sources.has(id)) {
      return
    }

    const gain = new Tone.Gain(0).toDestination()
    const panner = this.context.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance = audioConfig.distanceRolloff.minDistance
    panner.maxDistance = audioConfig.distanceRolloff.maxDistance
    panner.rolloffFactor = audioConfig.distanceRolloff.rolloffFactor
    panner.positionX.value = initialPosition.x
    panner.positionY.value = initialPosition.y
    panner.positionZ.value = initialPosition.z

    panner.connect(gain.input)

    const player = new Tone.Player({
      url: audioFile,
      loop,
      autostart: false,
      onload: () => {
        const source = this.sources.get(id)
        if (!source || !source.state.active || !source.state.loop || source.player.state === 'started') {
          return
        }
        source.player.start()
      }
    }).connect(panner)

    this.sources.set(id, {
      state: {
        id,
        file: audioFile,
        loop,
        position: initialPosition,
        velocity: { x: 0, y: 0, z: 0 },
        active: true
      },
      gain,
      panner,
      player
    })

    if (loop && player.loaded && player.state !== 'started') {
      player.start()
    }

    this.log(`[audio] create positional source id=${id} file=${audioFile}`)
  }

  updateSourcePosition(id: string, newPosition: Vec3): void {
    const source = this.sources.get(id)
    if (!source) {
      return
    }

    source.state.position = newPosition
    source.panner.positionX.value = newPosition.x
    source.panner.positionY.value = newPosition.y
    source.panner.positionZ.value = newPosition.z
  }

  setSourceVelocity(id: string, velocityVector: Vec3): void {
    const source = this.sources.get(id)
    if (!source) {
      return
    }

    source.state.velocity = velocityVector
  }

  setSourceActive(id: string, isActive: boolean): void {
    const source = this.sources.get(id)
    if (!source) {
      return
    }

    source.state.active = isActive
    if (isActive && source.state.loop && source.player.loaded && source.player.state !== 'started') {
      source.player.start()
    }
    if (!isActive && source.player.state === 'started') {
      source.player.stop()
    }
    source.gain.gain.rampTo(isActive ? 0.001 : 0, 0.1)
  }

  updateFrame(listenerPosition: Vec3): void {
    this.context.listener.positionX.value = listenerPosition.x
    this.context.listener.positionY.value = listenerPosition.y
    this.context.listener.positionZ.value = listenerPosition.z

    for (const source of this.sources.values()) {
      if (!source.state.active) {
        continue
      }

      const dx = source.state.position.x - listenerPosition.x
      const dy = source.state.position.y - listenerPosition.y
      const dz = source.state.position.z - listenerPosition.z
      const distance = Math.hypot(dx, dy, dz)
      const normalizedDistance = clamp(
        distance / audioConfig.distanceRolloff.maxDistance,
        0,
        1
      )
      const volume = 1 - normalizedDistance
      source.gain.gain.rampTo(volume * audioConfig.enemyVolume, 0.08)

      const speed = Math.hypot(source.state.velocity.x, source.state.velocity.y, source.state.velocity.z)
      if (source.player.loaded) {
        source.player.playbackRate = clamp(0.85 + speed / 12, 0.85, 1.35)
        if (source.state.loop && source.player.state !== 'started') {
          source.player.start()
        }
      }
    }
  }
}
