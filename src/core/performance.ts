export type PerformanceMode = 'auto' | 'high' | 'mobile';
export type PerformanceTier = 'high' | 'mobile';

export interface DeviceEnv {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  innerWidth?: number;
  devicePixelRatio?: number;
  coarsePointer?: boolean;
}

export interface PerformanceProfile {
  mode: PerformanceMode;
  tier: PerformanceTier;
  isIOS: boolean;
  maxPixelRatio: number;
  antialias: boolean;
  cameraWidth: number;
  cameraHeight: number;
  stringSegments: number;
  renderWaveCenterLine: boolean;
  renderGhostTrail: boolean;
  maxParticles: number;
  sparkBurstCount: number;
  waveGlitterCount: number;
  audioPolyphony: number;
  reverbDecaySec: number;
  disableBackdropBlur: boolean;
}

function readBrowserEnv(): DeviceEnv {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {};
  }
  let coarsePointer = false;
  try {
    coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  } catch {
    coarsePointer = false;
  }
  return {
    userAgent: navigator.userAgent || '',
    platform: navigator.platform || '',
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    innerWidth: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio ?? 1,
    coarsePointer,
  };
}

export function detectIsIOS(env: DeviceEnv = readBrowserEnv()): boolean {
  const ua = env.userAgent ?? '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ reports MacIntel with multi-touch
  if (env.platform === 'MacIntel' && (env.maxTouchPoints ?? 0) > 1) return true;
  return false;
}

export function detectIsMobileDevice(env: DeviceEnv = readBrowserEnv()): boolean {
  if (detectIsIOS(env)) return true;
  const ua = env.userAgent ?? '';
  if (/Android|webOS|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) return true;
  if (env.coarsePointer && (env.innerWidth ?? 1280) <= 1024) return true;
  return false;
}

export function resolvePerformanceProfile(
  mode: PerformanceMode = 'auto',
  env: DeviceEnv = readBrowserEnv()
): PerformanceProfile {
  const isIOS = detectIsIOS(env);
  const tier: PerformanceTier =
    mode === 'mobile'
      ? 'mobile'
      : mode === 'high'
        ? 'high'
        : detectIsMobileDevice(env)
          ? 'mobile'
          : 'high';

  if (tier === 'mobile') {
    return {
      mode,
      tier: 'mobile',
      isIOS,
      maxPixelRatio: 1.25,
      antialias: false,
      cameraWidth: 640,
      cameraHeight: 480,
      stringSegments: 32,
      renderWaveCenterLine: false,
      renderGhostTrail: false,
      maxParticles: 140,
      sparkBurstCount: 14,
      waveGlitterCount: 10,
      audioPolyphony: 6,
      reverbDecaySec: 1.4,
      disableBackdropBlur: true,
    };
  }

  return {
    mode,
    tier: 'high',
    isIOS,
    maxPixelRatio: 2.0,
    antialias: true,
    cameraWidth: 1280,
    cameraHeight: 720,
    stringSegments: 64,
    renderWaveCenterLine: true,
    renderGhostTrail: true,
    maxParticles: 420,
    sparkBurstCount: 40,
    waveGlitterCount: 32,
    audioPolyphony: 12,
    reverbDecaySec: 2.8,
    disableBackdropBlur: false,
  };
}
