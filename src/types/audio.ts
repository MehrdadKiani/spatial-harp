export interface PluckEvent {
  stringId: string;
  stringIndex: number;
  note: string;          // e.g. "C4", "G4"
  frequency: number;     // e.g. 261.63 Hz
  velocity: number;      // 0.0 (gentle) to 1.0 (hard stroke)
  contactRatio: number;  // 0.0 to 1.0 position along string
  handId: number;
  fingerIndex: number;   // Landmark index (8 = index, 12 = middle, 4 = thumb)
  timestamp: number;
}

export type SoundPresetId = 'harp' | 'laser' | 'chime' | 'retro8bit';

export interface SoundPresetInfo {
  id: SoundPresetId;
  label: string;
  description: string;
}

export type MusicalScaleId = 'pentatonic' | 'minor' | 'hirajoshi' | 'major' | 'blues';

export type PitchMode = 'fretted' | 'length';

export interface MusicalScaleInfo {
  id: MusicalScaleId;
  label: string;
  notes: string[];
  description: string;
}

export type DelayTimeDivision = '16n' | '16n.' | '8n' | '8n.' | '4n' | '4n.';

export interface AudioFxParams {
  reverbWet: number;         // Reverb mix 0..1
  delayWet: number;          // Delay mix 0..1
  delayFeedback: number;     // Delay feedback 0..0.85
  delayTime: DelayTimeDivision;
}

export interface AudioEngineConfig {
  volume?: number;       // Master volume in dB (default: -4 dB)
  reverbWet?: number;    // Reverb mix 0..1 (default: 0.3)
  delayWet?: number;     // Delay mix 0..1 (default: 0.12)
  polyphony?: number;    // Simultaneous voices (default: 8)
  preset?: SoundPresetId;
}
