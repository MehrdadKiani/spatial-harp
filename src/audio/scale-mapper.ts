import * as Tone from 'tone';
import { AnchoredString } from '../types/instruments';
import { MusicalScaleId, MusicalScaleInfo, PitchMode } from '../types/audio';

export const SCALES: Record<MusicalScaleId, MusicalScaleInfo> = {
  pentatonic: {
    id: 'pentatonic',
    label: 'C Major Pentatonic',
    description: 'Consonant & harmonious — impossible to play a wrong note',
    notes: [
      'C3', 'D3', 'E3', 'G3', 'A3',
      'C4', 'D4', 'E4', 'G4', 'A4',
      'C5', 'D5', 'E5', 'G5', 'A5',
      'C6', 'D6', 'E6',
    ],
  },
  minor: {
    id: 'minor',
    label: 'C Minor Pentatonic',
    description: 'Moody, introspective, and soulful ambient scale',
    notes: [
      'C3', 'Eb3', 'F3', 'G3', 'Bb3',
      'C4', 'Eb4', 'F4', 'G4', 'Bb4',
      'C5', 'Eb5', 'F5', 'G5', 'Bb5',
      'C6', 'Eb6', 'F6',
    ],
  },
  hirajoshi: {
    id: 'hirajoshi',
    label: 'Hirajōshi (Japanese)',
    description: 'Traditional exotic Japanese koto pentatonic tuning',
    notes: [
      'C3', 'Db3', 'F3', 'Gb3', 'Bb3',
      'C4', 'Db4', 'F4', 'Gb4', 'Bb4',
      'C5', 'Db5', 'F5', 'Gb5', 'Bb5',
      'C6', 'Db6', 'F6',
    ],
  },
  major: {
    id: 'major',
    label: 'C Major Diatonic',
    description: 'Bright classical 7-note diatonic European scale',
    notes: [
      'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
      'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
      'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5',
      'C6',
    ],
  },
  blues: {
    id: 'blues',
    label: 'Blues Hexatonic',
    description: 'Gritty blues scale featuring the expressive flat-fifth blue note',
    notes: [
      'C3', 'Eb3', 'F3', 'Gb3', 'G3', 'Bb3',
      'C4', 'Eb4', 'F4', 'Gb4', 'G4', 'Bb4',
      'C5', 'Eb5', 'F5', 'Gb5', 'G5', 'Bb5',
      'C6', 'Eb6',
    ],
  },
};

export const PENTATONIC_SCALE = SCALES.pentatonic.notes;

export class ScaleMapper {
  private scaleId: MusicalScaleId;
  private scale: string[];
  private pitchMode: PitchMode = 'length';
  private fretZones = 5;

  // Normalized string length bounds for acoustic pitch mapping:
  // Longer strings -> lower bass notes (index 0)
  // Shorter strings -> higher treble notes (index scale.length - 1)
  private minNormLength = 0.10;
  private maxNormLength = 0.82;

  constructor(initialScaleId: MusicalScaleId = 'pentatonic', initialPitchMode: PitchMode = 'length') {
    this.scaleId = initialScaleId;
    this.scale = SCALES[initialScaleId].notes;
    this.pitchMode = initialPitchMode;
  }

  public configure(options: {
    defaultScale?: MusicalScaleId;
    pitchMode?: PitchMode;
    fretZones?: number;
    minNormLengthForPitch?: number;
    maxNormLengthForPitch?: number;
  }): void {
    if (options.defaultScale && SCALES[options.defaultScale]) {
      this.setScaleById(options.defaultScale);
    }
    if (options.pitchMode === 'fretted' || options.pitchMode === 'length') {
      this.pitchMode = options.pitchMode;
    }
    if (options.fretZones !== undefined && options.fretZones >= 2) {
      this.fretZones = Math.floor(options.fretZones);
    }
    if (options.minNormLengthForPitch !== undefined) {
      this.minNormLength = options.minNormLengthForPitch;
    }
    if (options.maxNormLengthForPitch !== undefined) {
      this.maxNormLength = options.maxNormLengthForPitch;
    }
  }

  public setPitchMode(mode: PitchMode): void {
    this.pitchMode = mode;
  }

  public getPitchMode(): PitchMode {
    return this.pitchMode;
  }

  public getFretZones(): number {
    return this.fretZones;
  }

  /**
   * Evaluates the musical pitch of a string based on its physical 3D length (Mersenne's Law).
   * In 'fretted' mode (when contactRatio 0..1 is provided), the string is subdivided into
   * fretZones sequential scale notes oriented low-to-high (left->right, or bottom->top if vertical).
   */
  public getNoteForString(
    targetString: AnchoredString,
    _allStrings?: AnchoredString[],
    contactRatio?: number
  ): { note: string; frequency: number } {
    const dx = targetString.point2.x - targetString.point1.x;
    const dy = targetString.point2.y - targetString.point1.y;
    const dz = (targetString.point2.z - targetString.point1.z) * 0.5;
    const normLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Clamp length into [minNormLength, maxNormLength] and invert so shorter = higher index
    const clamped = Math.max(this.minNormLength, Math.min(this.maxNormLength, normLength));
    const pitchRatio = (this.maxNormLength - clamped) / (this.maxNormLength - this.minNormLength);

    const maxIndex = this.scale.length - 1;
    let scaleIndex: number;

    if (this.pitchMode === 'fretted' && contactRatio !== undefined) {
      const zones = Math.min(this.fretZones, this.scale.length);
      const maxBaseIndex = Math.max(0, maxIndex - (zones - 1));
      const baseIndex = Math.max(0, Math.min(maxBaseIndex, Math.round(pitchRatio * maxBaseIndex)));

      // Orient fret direction consistently low->high regardless of which endpoint was drawn first:
      // horizontal strings go left->right (smaller x -> larger x); vertical strings go bottom->top (larger y -> smaller y)
      const isMostlyHorizontal = Math.abs(dx) >= Math.abs(dy);
      const lowToHigh = isMostlyHorizontal ? dx >= 0 : dy <= 0;
      const clampedRatio = Math.max(0, Math.min(1, contactRatio));
      const orientedRatio = lowToHigh ? clampedRatio : 1 - clampedRatio;

      const fretOffset = Math.min(zones - 1, Math.floor(orientedRatio * zones));
      scaleIndex = Math.max(0, Math.min(maxIndex, baseIndex + fretOffset));
    } else {
      scaleIndex = Math.max(0, Math.min(maxIndex, Math.round(pitchRatio * maxIndex)));
    }

    const note = this.scale[scaleIndex];
    const frequency = Tone.Frequency(note).toFrequency();

    return { note, frequency };
  }

  public setScaleById(scaleId: MusicalScaleId): void {
    if (SCALES[scaleId]) {
      this.scaleId = scaleId;
      this.scale = SCALES[scaleId].notes;
    }
  }

  public setScale(scale: string[]): void {
    if (scale.length > 0) {
      this.scale = scale;
    }
  }

  public get currentScale(): string[] {
    return this.scale;
  }

  public get currentScaleId(): MusicalScaleId {
    return this.scaleId;
  }

  public getScales(): MusicalScaleInfo[] {
    return Object.values(SCALES);
  }
}
