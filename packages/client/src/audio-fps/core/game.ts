import Phaser from 'phaser'
import { AudioManager } from '../audio/audioManager.js'
import { GameLoop } from './gameLoop.js'
import { InputController } from './input.js'
import { createWorldState } from './worldState.js'
import { Pseudo3dRenderer } from './pseudo3dRenderer.js'
import { AudioPanel } from '../ui/audioPanel.js'
import type { WorldState } from './worldTypes.js'

class AudioFpsScene extends Phaser.Scene {
  private loop!: GameLoop
  private world!: WorldState
  private pseudoRenderer!: Pseudo3dRenderer
  private audioPanel!: AudioPanel
  private logs: string[] = []

  constructor() {
    super('audio-fps-scene')
  }

  create(): void {
    this.world = createWorldState(true)
    const input = new InputController(this)

    const debugText = this.add.text(16, 14, 'initializing...', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#9ee8ff',
      lineSpacing: 5
    })
    debugText.setDepth(5)
    debugText.setScrollFactor(0)

    const logText = this.add.text(16, 220, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#a8ffc8',
      lineSpacing: 4
    })
    logText.setDepth(5)
    logText.setScrollFactor(0)

    const audio = new AudioManager((message) => {
      this.logs.push(message)
      if (this.logs.length > 7) {
        this.logs.shift()
      }
      logText.setText(this.logs)
    })

    void audio.ensureStarted()

    this.audioPanel = new AudioPanel(this, audio)

    this.loop = new GameLoop(this, this.world, input, audio, debugText, this.audioPanel)

    this.input.on('pointerdown', () => {
      void audio.ensureStarted()
    })

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      this.audioPanel.handleInput(event.key)
    })

    this.events.on('debug-log', (message: string) => {
      this.logs.push(message)
      if (this.logs.length > 7) {
        this.logs.shift()
      }
      logText.setText(this.logs)
    })

    const graphics = this.add.graphics()
    this.pseudoRenderer = new Pseudo3dRenderer(graphics)
  }

  update(_time: number, delta: number): void {
    this.loop.update(Math.min(delta / 1000, 0.05))
    this.pseudoRenderer.render(this.world, this.scale.width, this.scale.height)
  }
}

export class AudioFpsGame {
  private readonly game: Phaser.Game

  constructor(parentId = 'audioFpsRoot') {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parentId,
      width: 1080,
      height: 720,
      backgroundColor: '#05080d',
      scene: [AudioFpsScene],
      render: {
        antialias: true,
        pixelArt: false
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      }
    })
  }

  destroy(): void {
    this.game.destroy(true)
  }
}
