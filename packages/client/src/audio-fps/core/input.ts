import Phaser from 'phaser'

export interface InputSnapshot {
  moveForward: boolean
  moveBackward: boolean
  strafeLeft: boolean
  strafeRight: boolean
  turnLeft: boolean
  turnRight: boolean
  firePressed: boolean
  manualPingPressed: boolean
  compassPressed: boolean
  spawnTankPressed: boolean
  spawnMechPressed: boolean
  spawnHelicopterPressed: boolean
  spawnDronePressed: boolean
  toggleAudioPanelPressed: boolean
}

export class InputController {
  private readonly keys: {
    w: Phaser.Input.Keyboard.Key
    a: Phaser.Input.Keyboard.Key
    s: Phaser.Input.Keyboard.Key
    d: Phaser.Input.Keyboard.Key
    q: Phaser.Input.Keyboard.Key
    e: Phaser.Input.Keyboard.Key
    up: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
    space: Phaser.Input.Keyboard.Key
    p: Phaser.Input.Keyboard.Key
    c: Phaser.Input.Keyboard.Key
    numpad1: Phaser.Input.Keyboard.Key
    numpad2: Phaser.Input.Keyboard.Key
    numpad3: Phaser.Input.Keyboard.Key
    numpad4: Phaser.Input.Keyboard.Key
    numpadMultiply: Phaser.Input.Keyboard.Key
  }

  constructor(scene: Phaser.Scene) {
    this.keys = {
      w: scene.input.keyboard!.addKey('W'),
      a: scene.input.keyboard!.addKey('A'),
      s: scene.input.keyboard!.addKey('S'),
      d: scene.input.keyboard!.addKey('D'),
      q: scene.input.keyboard!.addKey('Q'),
      e: scene.input.keyboard!.addKey('E'),
      up: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      space: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      p: scene.input.keyboard!.addKey('P'),
      c: scene.input.keyboard!.addKey('C'),
      numpad1: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ONE),
      numpad2: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_TWO),
      numpad3: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_THREE),
      numpad4: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_FOUR),
      numpadMultiply: scene.input.keyboard!.addKey('*')
    }
  }

  sample(): InputSnapshot {
    const forward = this.keys.w.isDown || this.keys.up.isDown
    const backward = this.keys.s.isDown || this.keys.down.isDown
    const turnLeft = this.keys.q.isDown || this.keys.left.isDown
    const turnRight = this.keys.e.isDown || this.keys.right.isDown

    return {
      moveForward: forward,
      moveBackward: backward,
      strafeLeft: this.keys.a.isDown,
      strafeRight: this.keys.d.isDown,
      turnLeft,
      turnRight,
      firePressed: Phaser.Input.Keyboard.JustDown(this.keys.space),
      manualPingPressed: Phaser.Input.Keyboard.JustDown(this.keys.p),
      compassPressed: Phaser.Input.Keyboard.JustDown(this.keys.c),
      spawnTankPressed: Phaser.Input.Keyboard.JustDown(this.keys.numpad1),
      spawnMechPressed: Phaser.Input.Keyboard.JustDown(this.keys.numpad2),
      spawnHelicopterPressed: Phaser.Input.Keyboard.JustDown(this.keys.numpad3),
      spawnDronePressed: Phaser.Input.Keyboard.JustDown(this.keys.numpad4),
      toggleAudioPanelPressed: Phaser.Input.Keyboard.JustDown(this.keys.numpadMultiply)
    }
  }
}
