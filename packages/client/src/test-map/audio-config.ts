export const AUDIO_CONFIG = {
  player: {
    footstepIntervalSeconds: 0.38,
    bumpThrottleSeconds: 0.4,
    servoVolume: 0.85,
    aimAssistBaseFrequency: 220,
    aimAssistMaxFrequency: 960,
    aimAssistGain: 0.09,
    aimAssistLockThresholdRadians: 0.05,
    aimAssistUpdateLerp: 0.12,
    sonarActiveDurationSeconds: 0.28,
    environmentalSonarIntervalSeconds: 1.25,
    environmentalSonarEchoDelayPerUnit: 0.026,
    environmentalSonarMaxEchoDistance: 14,
    boundaryWarningDistance: 6,
    boundaryWarningIntervalFarSeconds: 0.95,
    boundaryWarningIntervalNearSeconds: 0.16,
    passiveRadarMinIntervalSeconds: 1.0,
    passiveRadarMaxIntervalSeconds: 3.0,
    passiveRadarEchoGain: 0.12
  },
  enemy: {
    maxDistance: 72,
    baseVolume: 0.9,
    idleFadeSeconds: 0.2,
    movementFadeSeconds: 0.15,
    attackDucking: 0.9,
    attackDuckingSeconds: 0.2,
    passivePingMinMs: 1000,
    passivePingMaxMs: 3000,
    threatCueDelayMs: 360,
    dopplerCentsMin: -250,
    dopplerCentsMax: 250,
    altitudePitchScale: 0.014,
    altitudeFilterScale: 50,
    turnCueThresholdRadians: 0.08,
    turnCueCooldownSeconds: 0.2
  },
  tank: {
    type: 'tank',
    category: 'ground',
    height: 0,
    baseVolume: 0.85,
    passivePingRateMs: 1650,
    movementVariance: 0.14,
    threatCueDelayMs: 360
  }
} as const
