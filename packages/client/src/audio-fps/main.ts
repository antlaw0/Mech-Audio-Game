import { AudioFpsGame } from './core/game.js'

let activeGame: AudioFpsGame | null = null

const start = (): void => {
  if (activeGame) {
    activeGame.destroy()
  }
  activeGame = new AudioFpsGame('audioFpsRoot')
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true })
} else {
  start()
}
