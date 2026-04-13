import Phaser from 'phaser'
import * as Tone from 'tone'
import type { AudioManager } from '../audio/audioManager.js'
import audioConfig from '../config/audioConfig.json'

interface SliderControl {
  label: string
  value: number
  min: number
  max: number
  step: number
  get: () => number
  set: (value: number) => void
}

export class AudioPanel {
  private isOpen = false
  private selectedSliderIndex = 0
  private panelText: Phaser.GameObjects.Text
  private sliders: SliderControl[] = []

  constructor(private scene: Phaser.Scene, private audio: AudioManager) {
    this.panelText = this.scene.add.text(20, 20, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffff00',
      lineSpacing: 3,
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 10 }
    })
    this.panelText.setDepth(100)
    this.panelText.setScrollFactor(0)
    this.panelText.setVisible(false)

    this.initializeSliders()
  }

  private initializeSliders(): void {
    this.sliders = [
      {
        label: 'Master Volume',
        get: () => audioConfig.masterVolume,
        set: (v) => {
          audioConfig.masterVolume = v
          Tone.Destination.volume.value = Tone.gainToDb(v)
        },
        value: audioConfig.masterVolume,
        min: 0,
        max: 1,
        step: 0.05
      },
      {
        label: 'Enemy/Loop Volume',
        get: () => audioConfig.enemyVolume,
        set: (v) => {
          audioConfig.enemyVolume = v
        },
        value: audioConfig.enemyVolume,
        min: 0,
        max: 1,
        step: 0.05
      },
      {
        label: 'UI Volume',
        get: () => audioConfig.uiVolume,
        set: (v) => {
          audioConfig.uiVolume = v
        },
        value: audioConfig.uiVolume,
        min: 0,
        max: 1,
        step: 0.05
      },
      {
        label: 'Obstacle Volume',
        get: () => audioConfig.obstacleVolume,
        set: (v) => {
          audioConfig.obstacleVolume = v
        },
        value: audioConfig.obstacleVolume,
        min: 0,
        max: 1,
        step: 0.05
      },
      {
        label: 'Terrain Step Volume',
        get: () => audioConfig.terrainAudio?.terrainStepVolume ?? 0.56,
        set: (v) => {
          if (audioConfig.terrainAudio) {
            audioConfig.terrainAudio.terrainStepVolume = v
          }
        },
        value: audioConfig.terrainAudio?.terrainStepVolume ?? 0.56,
        min: 0,
        max: 1,
        step: 0.05
      },
      {
        label: 'Ambience Volume',
        get: () => audioConfig.terrainAudio?.ambienceVolume ?? 0.32,
        set: (v) => {
          if (audioConfig.terrainAudio) {
            audioConfig.terrainAudio.ambienceVolume = v
          }
        },
        value: audioConfig.terrainAudio?.ambienceVolume ?? 0.32,
        min: 0,
        max: 1,
        step: 0.05
      },
      {
        label: 'Distance Rolloff: Min Distance',
        get: () => audioConfig.distanceRolloff.minDistance,
        set: (v) => {
          audioConfig.distanceRolloff.minDistance = v
        },
        value: audioConfig.distanceRolloff.minDistance,
        min: 0.1,
        max: 10,
        step: 0.2
      },
      {
        label: 'Distance Rolloff: Max Distance',
        get: () => audioConfig.distanceRolloff.maxDistance,
        set: (v) => {
          audioConfig.distanceRolloff.maxDistance = v
        },
        value: audioConfig.distanceRolloff.maxDistance,
        min: 10,
        max: 100,
        step: 2
      },
      {
        label: 'Distance Rolloff: Rolloff Factor',
        get: () => audioConfig.distanceRolloff.rolloffFactor,
        set: (v) => {
          audioConfig.distanceRolloff.rolloffFactor = v
        },
        value: audioConfig.distanceRolloff.rolloffFactor,
        min: 0.1,
        max: 3,
        step: 0.1
      },
      {
        label: 'Max Transient Voices',
        get: () => audioConfig.voiceManagement?.maxTransientVoices ?? 48,
        set: (v) => {
          if (audioConfig.voiceManagement) {
            audioConfig.voiceManagement.maxTransientVoices = Math.round(v)
          }
        },
        value: audioConfig.voiceManagement?.maxTransientVoices ?? 48,
        min: 16,
        max: 128,
        step: 4
      },
      {
        label: 'Default Sample Pool Size',
        get: () => audioConfig.voiceManagement?.defaultSamplePoolSize ?? 6,
        set: (v) => {
          if (audioConfig.voiceManagement) {
            audioConfig.voiceManagement.defaultSamplePoolSize = Math.round(v)
          }
        },
        value: audioConfig.voiceManagement?.defaultSamplePoolSize ?? 6,
        min: 2,
        max: 16,
        step: 1
      },
      {
        label: 'Max Sample Pool Size',
        get: () => audioConfig.voiceManagement?.maxSamplePoolSize ?? 16,
        set: (v) => {
          if (audioConfig.voiceManagement) {
            audioConfig.voiceManagement.maxSamplePoolSize = Math.round(v)
          }
        },
        value: audioConfig.voiceManagement?.maxSamplePoolSize ?? 16,
        min: 4,
        max: 32,
        step: 2
      },
      {
        label: 'Enemy Volume Scale: Tank',
        get: () => audioConfig.enemyCueVolumeScales?.tank ?? 0.95,
        set: (v) => {
          if (audioConfig.enemyCueVolumeScales) {
            audioConfig.enemyCueVolumeScales.tank = v
          }
        },
        value: audioConfig.enemyCueVolumeScales?.tank ?? 0.95,
        min: 0.1,
        max: 1,
        step: 0.05
      },
      {
        label: 'Enemy Volume Scale: Mech',
        get: () => audioConfig.enemyCueVolumeScales?.mech ?? 0.85,
        set: (v) => {
          if (audioConfig.enemyCueVolumeScales) {
            audioConfig.enemyCueVolumeScales.mech = v
          }
        },
        value: audioConfig.enemyCueVolumeScales?.mech ?? 0.85,
        min: 0.1,
        max: 1,
        step: 0.05
      },
      {
        label: 'Enemy Volume Scale: Helicopter',
        get: () => audioConfig.enemyCueVolumeScales?.helicopter ?? 0.82,
        set: (v) => {
          if (audioConfig.enemyCueVolumeScales) {
            audioConfig.enemyCueVolumeScales.helicopter = v
          }
        },
        value: audioConfig.enemyCueVolumeScales?.helicopter ?? 0.82,
        min: 0.1,
        max: 1,
        step: 0.05
      },
      {
        label: 'Enemy Volume Scale: Drone',
        get: () => audioConfig.enemyCueVolumeScales?.drone ?? 0.78,
        set: (v) => {
          if (audioConfig.enemyCueVolumeScales) {
            audioConfig.enemyCueVolumeScales.drone = v
          }
        },
        value: audioConfig.enemyCueVolumeScales?.drone ?? 0.78,
        min: 0.1,
        max: 1,
        step: 0.05
      }
    ]
  }

  toggle(): void {
    this.isOpen = !this.isOpen
    this.selectedSliderIndex = 0
    this.panelText.setVisible(this.isOpen)
    this.updateDisplay()
  }

  handleInput(key: string): void {
    if (!this.isOpen) {
      return
    }

    if (key === 'ArrowUp') {
      this.selectedSliderIndex = Math.max(0, this.selectedSliderIndex - 1)
    } else if (key === 'ArrowDown') {
      this.selectedSliderIndex = Math.min(this.sliders.length - 1, this.selectedSliderIndex + 1)
    } else if (key === 'ArrowLeft') {
      this.adjustSelectedSlider(-1)
    } else if (key === 'ArrowRight') {
      this.adjustSelectedSlider(1)
    } else if (key === 'Escape') {
      this.toggle()
    }

    this.updateDisplay()
  }

  private adjustSelectedSlider(direction: number): void {
    if (this.selectedSliderIndex < 0 || this.selectedSliderIndex >= this.sliders.length) {
      return
    }

    const slider = this.sliders[this.selectedSliderIndex]!
    const adjustment = slider.step * direction
    const newValue = Math.max(slider.min, Math.min(slider.max, slider.value + adjustment))
    slider.value = newValue
    slider.set(newValue)
  }

  private updateDisplay(): void {
    const lines: string[] = [
      '╔════════════════════════════════════════════╗',
      '║         AUDIO ADJUSTMENT PANEL             ║',
      '║  Use arrow keys to navigate and adjust     ║',
      '║  ESC to close                              ║',
      '╠════════════════════════════════════════════╣'
    ]

    for (let i = 0; i < this.sliders.length; i++) {
      const slider = this.sliders[i]!
      const isSelected = i === this.selectedSliderIndex
      const barLength = 30
      const filledLength = Math.round(((slider.value - slider.min) / (slider.max - slider.min)) * barLength)
      const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength)

      const prefix = isSelected ? '► ' : '  '
      const valuStr = slider.value.toFixed(2)
      const line = `${prefix}${slider.label.padEnd(35)} [${bar}] ${valuStr}`

      lines.push(line)
    }

    lines.push('╚════════════════════════════════════════════╝')

    this.panelText.setText(lines.join('\n'))
  }
}
