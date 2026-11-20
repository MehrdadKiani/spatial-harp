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

export interface AudioEngineConfig {
  volume?: number;       // Master volume in dB (default: -4 dB)
  reverbWet?: number;    // Reverb mix 0..1 (default: 0.3)
  delayWet?: number;     // Delay mix 0..1 (default: 0.12)
  polyphony?: number;    // Simultaneous voices (default: 8)
}
