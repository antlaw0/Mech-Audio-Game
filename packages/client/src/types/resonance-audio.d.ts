declare module 'resonance-audio' {
  interface ResonanceAudioSource {
    input: AudioNode
    setPosition(x: number, y: number, z: number): void
    setOrientation(forwardX: number, forwardY: number, forwardZ: number, upX: number, upY: number, upZ: number): void
    setGain(gain: number): void
    setMinDistance(distance: number): void
    setMaxDistance(distance: number): void
    setDirectivityPattern(alpha: number, sharpness: number): void
  }

  interface ResonanceAudioScene {
    output: AudioNode
    createSource(): ResonanceAudioSource
    setListenerPosition(x: number, y: number, z: number): void
    setListenerOrientation(forwardX: number, forwardY: number, forwardZ: number, upX: number, upY: number, upZ: number): void
  }

  interface ResonanceAudioOptions {
    ambisonicOrder?: number
  }

  interface ResonanceAudioConstructor {
    new (audioContext: AudioContext, options?: ResonanceAudioOptions): ResonanceAudioScene
  }

  const ResonanceAudio: ResonanceAudioConstructor
  export default ResonanceAudio
}