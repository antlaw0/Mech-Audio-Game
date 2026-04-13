import * as Tone from 'tone'
import audioConfig from '../config/audioConfig.json'

const FIELD_STEP_FILES = Array.from(
  { length: 16 },
  (_, index) => `assets/sounds/steps/field/${index + 1}.ogg`
)

const TERRAIN_STEP_FILES: Record<string, string[]> = {
  field: FIELD_STEP_FILES
}

export interface TerrainAudioMetrics {
  ambienceActive: boolean
  ambienceFile: string | null
  terrainStepPools: number
}

interface TerrainStepPool {
  gain: Tone.Gain
  players: Tone.Player[]
}

export class TerrainAudioEngine {
  private readonly stepPools = new Map<string, TerrainStepPool>()
  private readonly ambienceGain = new Tone.Gain(0).toDestination()
  private ambiencePlayer: Tone.Player | null = null
  private ambienceFile: string | null = null

  constructor(private readonly log: (message: string) => void) {}

  primeTerrain(terrainType: string): void {
    const terrain = terrainType in TERRAIN_STEP_FILES ? terrainType : 'field'
    this.getOrCreatePool(terrain)
  }

  ensureAmbience(terrainType: string): void {
    const terrain = terrainType in TERRAIN_STEP_FILES ? terrainType : 'field'
    const ambienceTrack = audioConfig.terrainAudio?.ambienceTrack ?? 'day'
    const ambienceFile = `assets/sounds/ambience/${terrain}/${ambienceTrack}.ogg`

    this.ambienceGain.gain.rampTo(audioConfig.terrainAudio?.ambienceVolume ?? 0.3, 0.1)

    if (this.ambienceFile === ambienceFile && this.ambiencePlayer) {
      if (this.ambiencePlayer.loaded && this.ambiencePlayer.state !== 'started') {
        this.ambiencePlayer.start()
      }
      return
    }

    if (this.ambiencePlayer) {
      this.ambiencePlayer.stop()
      this.ambiencePlayer.dispose()
      this.ambiencePlayer = null
    }

    this.ambienceFile = ambienceFile
    this.ambiencePlayer = new Tone.Player({
      url: ambienceFile,
      loop: true,
      autostart: false,
      onload: () => {
        const currentAmbience = this.ambiencePlayer
        if (currentAmbience && currentAmbience.state !== 'started' && this.ambienceFile === ambienceFile) {
          currentAmbience.start()
        }
      }
    }).connect(this.ambienceGain)

    if (this.ambiencePlayer.loaded && this.ambiencePlayer.state !== 'started') {
      this.ambiencePlayer.start()
    }

    this.log(`[audio] ambience terrain=${terrain} file=${ambienceFile}`)
  }

  playTerrainStep(terrainType: string): void {
    const terrain = terrainType in TERRAIN_STEP_FILES ? terrainType : 'field'
    const pool = this.getOrCreatePool(terrain)
    pool.gain.gain.rampTo(audioConfig.terrainAudio?.terrainStepVolume ?? 0.55, 0.02)

    const randomStart = Math.floor(Math.random() * pool.players.length)
    for (let offset = 0; offset < pool.players.length; offset += 1) {
      const index = (randomStart + offset) % pool.players.length
      const player = pool.players[index]
      if (!player || !player.loaded || player.state === 'started') {
        continue
      }

      player.start()
      return
    }

    const fallback = pool.players[randomStart]
    if (!fallback || !fallback.loaded) {
      return
    }

    if (fallback.state === 'started') {
      fallback.stop()
    }
    fallback.start(Tone.now() + 0.003)
  }

  getMetrics(): TerrainAudioMetrics {
    return {
      ambienceActive: this.ambiencePlayer?.state === 'started',
      ambienceFile: this.ambienceFile,
      terrainStepPools: this.stepPools.size
    }
  }

  private getOrCreatePool(terrainType: string): TerrainStepPool {
    const existing = this.stepPools.get(terrainType)
    if (existing) {
      return existing
    }

    const files = TERRAIN_STEP_FILES[terrainType] ?? TERRAIN_STEP_FILES.field ?? []
    const gain = new Tone.Gain(audioConfig.terrainAudio?.terrainStepVolume ?? 0.55).toDestination()
    const players = files.map((file) => new Tone.Player(file).connect(gain))
    const created: TerrainStepPool = {
      gain,
      players
    }

    this.stepPools.set(terrainType, created)
    return created
  }
}
