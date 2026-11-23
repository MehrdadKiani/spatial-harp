import { MusicalScaleId, SoundPresetId } from '../types/audio';

export interface VisionConfigGroup {
  _comment?: string;
  cameraWidth: number;
  cameraHeight: number;
  numHands: number;
  smoothingAlpha: number;
  minHandDetectionConfidence: number;
  minHandPresenceConfidence: number;
  minTrackingConfidence: number;
  wasmPath: string;
  modelAssetPath: string;
}

export interface PinchConfigGroup {
  _comment?: string;
  pinchThreshold: number;
  releaseThreshold: number;
}

export interface StringsConfigGroup {
  _comment?: string;
  maxStrings: number;
  minAnchorDistance: number;
  minStretchDurationMs: number;
  releaseGraceMs: number;
  cooldownMs: number;
  grabProximityThreshold: number;
  grabPinchDistance: number;
  grabDwellMs: number;
  maxGrabHandSpeed: number;
  postGrabReleaseCooldownMs: number;
  palette: string[];
}

export interface PluckingConfigGroup {
  _comment?: string;
  pluckingFingers: number[];
  depthTolerance: number;
  touchRadius: number;
  releaseRadius: number;
  tipMarginRatio: number;
  tipMarginRadius: number;
  minPluckTravel: number;
  retriggerCooldownMs: number;
  stringCooldownMs: number;
}

export interface AudioConfigGroup {
  _comment?: string;
  defaultPreset: SoundPresetId;
  defaultScale: MusicalScaleId;
  volumeDb: number;
  reverbWet: number;
  delayWet: number;
  polyphony: number;
  minNormLengthForPitch: number;
  maxNormLengthForPitch: number;
}

export interface VisualsConfigGroup {
  _comment?: string;
  skeletonShowBones: boolean;
  skeletonFingertipsOnly: boolean;
  skeletonJointRadius: number;
  skeletonFingertipScale: number;
  skeletonReferencePalmSpan: number;
  skeletonMinJointScale: number;
  skeletonMaxJointScale: number;
  baselineGlowHalfWidth: number;
  waveCoreHalfWidth: number;
  waveGlowHalfWidth: number;
  previewCoreHalfWidth: number;
  previewHaloHalfWidth: number;
  rulerTickOpacity: number;
  previewRulerTickOpacity: number;
  majorTickHeight: number;
  minorTickHeight: number;
  waveAmplitude: number;
  waveFrequency: number;
  waveSpeed: number;
  waveDamping: number;
  waveDurationSec: number;
  waveCycles: number;
  numEchoContours: number;
  contactStarburstRays: number;
  contactStarburstOpacity: number;
  contactStarburstDurationSec: number;
  contactStarburstMaxRadius: number;
  sparkPointSize: number;
  contactSparkBurstCount: number;
  waveGlitterParticleCount: number;
}

export interface UiConfigGroup {
  _comment?: string;
  showTutorialOnStart: boolean;
}

export interface AppConfig {
  _comment?: string;
  vision: VisionConfigGroup;
  pinch: PinchConfigGroup;
  strings: StringsConfigGroup;
  plucking: PluckingConfigGroup;
  audio: AudioConfigGroup;
  visuals: VisualsConfigGroup;
  ui: UiConfigGroup;
}

const LOCAL_STORAGE_KEY = 'spatial_harp_overrides_v1';

export const DEFAULT_CONFIG: AppConfig = {
  vision: {
    cameraWidth: 1280,
    cameraHeight: 720,
    numHands: 2,
    smoothingAlpha: 0.75,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
    wasmPath: '/wasm',
    modelAssetPath: '/models/hand_landmarker.task',
  },
  pinch: {
    pinchThreshold: 0.055,
    releaseThreshold: 0.080,
  },
  strings: {
    maxStrings: 12,
    minAnchorDistance: 0.10,
    minStretchDurationMs: 150,
    releaseGraceMs: 120,
    cooldownMs: 350,
    grabProximityThreshold: 0.045,
    grabPinchDistance: 0.052,
    grabDwellMs: 35,
    maxGrabHandSpeed: 1.10,
    postGrabReleaseCooldownMs: 250,
    palette: [
      '#00f0ff',
      '#38ef7d',
      '#9b51e0',
      '#ff007f',
      '#ffaa00',
      '#00e5ff',
      '#76ff03',
      '#e040fb',
    ],
  },
  plucking: {
    pluckingFingers: [4, 8, 12, 16, 20],
    depthTolerance: 0.55,
    touchRadius: 0.036,
    releaseRadius: 0.054,
    tipMarginRatio: 0.02,
    tipMarginRadius: 0.016,
    minPluckTravel: 0.0025,
    retriggerCooldownMs: 120,
    stringCooldownMs: 110,
  },
  audio: {
    defaultPreset: 'harp',
    defaultScale: 'pentatonic',
    volumeDb: -4,
    reverbWet: 0.30,
    delayWet: 0.12,
    polyphony: 12,
    minNormLengthForPitch: 0.10,
    maxNormLengthForPitch: 0.82,
  },
  visuals: {
    skeletonShowBones: false,
    skeletonFingertipsOnly: true,
    skeletonJointRadius: 0.0045,
    skeletonFingertipScale: 1.28,
    skeletonReferencePalmSpan: 0.18,
    skeletonMinJointScale: 0.42,
    skeletonMaxJointScale: 1.15,
    baselineGlowHalfWidth: 0.0022,
    waveCoreHalfWidth: 0.0014,
    waveGlowHalfWidth: 0.0038,
    previewCoreHalfWidth: 0.0008,
    previewHaloHalfWidth: 0.0038,
    rulerTickOpacity: 0.14,
    previewRulerTickOpacity: 0.18,
    majorTickHeight: 0.010,
    minorTickHeight: 0.005,
    waveAmplitude: 0.042,
    waveFrequency: 26.0,
    waveSpeed: 1.65,
    waveDamping: 2.05,
    waveDurationSec: 1.75,
    waveCycles: 3.5,
    numEchoContours: 5,
    contactStarburstRays: 18,
    contactStarburstOpacity: 0.28,
    contactStarburstDurationSec: 0.24,
    contactStarburstMaxRadius: 0.036,
    sparkPointSize: 0.009,
    contactSparkBurstCount: 40,
    waveGlitterParticleCount: 32,
  },
  ui: {
    showTutorialOnStart: false,
  },
};

/**
 * Strips optional // or /* ... * / comments from JSON text before JSON.parse
 */
function stripJsonComments(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Converts hex color strings (e.g. "#00f0ff" or "0x00f0ff") into numeric hex values
 */
export function parseHexPalette(palette: string[]): number[] {
  const parsed = palette
    .map((str) => {
      const cleaned = str.trim().replace(/^#/, '').replace(/^0x/i, '');
      const val = parseInt(cleaned, 16);
      return Number.isNaN(val) ? null : val;
    })
    .filter((v): v is number => v !== null);

  return parsed.length > 0 ? parsed : [0x00f0ff, 0x38ef7d, 0x9b51e0, 0xff007f];
}

export interface StoredUserOverrides {
  defaultPreset?: SoundPresetId;
  defaultScale?: MusicalScaleId;
}

export function loadUserOverrides(): StoredUserOverrides {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredUserOverrides;
  } catch {
    return {};
  }
}

export function saveUserOverride(patch: StoredUserOverrides): void {
  try {
    const current = loadUserOverrides();
    const updated = { ...current, ...patch };
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage quota/privacy errors
  }
}

export function clearUserOverrides(): void {
  try {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Loads /config.json, merges over DEFAULT_CONFIG, and applies any saved localStorage HUD overrides
 */
export async function loadAppConfig(url = '/config.json'): Promise<AppConfig> {
  const merged: AppConfig = {
    vision: { ...DEFAULT_CONFIG.vision },
    pinch: { ...DEFAULT_CONFIG.pinch },
    strings: { ...DEFAULT_CONFIG.strings, palette: [...DEFAULT_CONFIG.strings.palette] },
    plucking: { ...DEFAULT_CONFIG.plucking, pluckingFingers: [...DEFAULT_CONFIG.plucking.pluckingFingers] },
    audio: { ...DEFAULT_CONFIG.audio },
    visuals: { ...DEFAULT_CONFIG.visuals },
    ui: { ...DEFAULT_CONFIG.ui },
  };

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (response.ok) {
      const text = await response.text();
      const json = JSON.parse(stripJsonComments(text)) as Partial<AppConfig>;

      if (json.vision) Object.assign(merged.vision, json.vision);
      if (json.pinch) Object.assign(merged.pinch, json.pinch);
      if (json.strings) Object.assign(merged.strings, json.strings);
      if (json.plucking) Object.assign(merged.plucking, json.plucking);
      if (json.audio) Object.assign(merged.audio, json.audio);
      if (json.visuals) Object.assign(merged.visuals, json.visuals);
      if (json.ui) Object.assign(merged.ui, json.ui);
    }
  } catch (err) {
    console.warn('Could not load /config.json, using typed DEFAULT_CONFIG fallback:', err);
  }

  // Apply persisted HUD overrides from localStorage
  const overrides = loadUserOverrides();
  if (overrides.defaultPreset) {
    merged.audio.defaultPreset = overrides.defaultPreset;
  }
  if (overrides.defaultScale) {
    merged.audio.defaultScale = overrides.defaultScale;
  }

  return merged;
}
