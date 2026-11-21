import * as Tone from 'tone';
import { AnchoredString } from '../types/instruments';
import { MusicalScaleId, MusicalScaleInfo } from '../types/audio';

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

  // Normalized string length bounds for acoustic pitch mapping:
  // Longer strings -> lower bass notes (index 0)
  // Shorter strings -> higher treble notes (index scale.length - 1)
  private readonly minNormLength = 0.10;
  private readonly maxNormLength = 0.82;

  constructor(initialScaleId: MusicalScaleId = 'pentatonic') {
    this.scaleId = initialScaleId;
    this.scale = SCALES[initialScaleId].notes;
  }

  /**
   * Evaluates the musical pitch of a string based on its physical 3D length
   * (Mersenne's Law: shorter strings produce higher pitches, longer strings produce deeper bass pitches).
   * Resizing a string dynamically shifts its note across the active 3-octave musical scale.
   */
  public getNoteForString(
    targetString: AnchoredString,
    _allStrings?: AnchoredString[]
  ): { note: string; frequency: number } {
    const dx = targetString.point2.x - targetString.point1.x;
    const dy = targetString.point2.y - targetString.point1.y;
    const dz = (targetString.point2.z - targetString.point1.z) * 0.5;
    const normLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Clamp length into [minNormLength, maxNormLength] and invert so shorter = higher index
    const clamped = Math.max(this.minNormLength, Math.min(this.maxNormLength, normLength));
    const pitchRatio = (this.maxNormLength - clamped) / (this.maxNormLength - this.minNormLength);

    const maxIndex = this.scale.length - 1;
    const scaleIndex = Math.max(0, Math.min(maxIndex, Math.round(pitchRatio * maxIndex)));
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
