import * as Tone from 'tone';
import { AnchoredString } from '../types/instruments';
import { MusicalScaleId, MusicalScaleInfo } from '../types/audio';

export const SCALES: Record<MusicalScaleId, MusicalScaleInfo> = {
  pentatonic: {
    id: 'pentatonic',
    label: 'C Major Pentatonic',
    description: 'Consonant & harmonious — impossible to play a wrong note',
    notes: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6'],
  },
  minor: {
    id: 'minor',
    label: 'C Minor Pentatonic',
    description: 'Moody, introspective, and soulful ambient scale',
    notes: ['C4', 'Eb4', 'F4', 'G4', 'Bb4', 'C5', 'Eb5', 'F5', 'G5', 'Bb5', 'C6', 'Eb6'],
  },
  hirajoshi: {
    id: 'hirajoshi',
    label: 'Hirajōshi (Japanese)',
    description: 'Traditional exotic Japanese koto pentatonic tuning',
    notes: ['C4', 'Db4', 'F4', 'Gb4', 'Bb4', 'C5', 'Db5', 'F5', 'Gb5', 'Bb5', 'C6', 'Db6'],
  },
  major: {
    id: 'major',
    label: 'C Major Diatonic',
    description: 'Bright classical 7-note diatonic European scale',
    notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5'],
  },
  blues: {
    id: 'blues',
    label: 'Blues Hexatonic',
    description: 'Gritty blues scale featuring the expressive flat-fifth blue note',
    notes: ['C4', 'Eb4', 'F4', 'Gb4', 'G4', 'Bb4', 'C5', 'Eb5', 'F5', 'Gb5', 'G5', 'Bb5'],
  },
};

export const PENTATONIC_SCALE = SCALES.pentatonic.notes;

export class ScaleMapper {
  private scaleId: MusicalScaleId;
  private scale: string[];

  constructor(initialScaleId: MusicalScaleId = 'pentatonic') {
    this.scaleId = initialScaleId;
    this.scale = SCALES[initialScaleId].notes;
  }

  /**
   * Evaluates the musical pitch of a string by sorting all active strings horizontally
   * from left to right (lowest pitch on the left, highest on the right), matching acoustic concert harps.
   */
  public getNoteForString(
    targetString: AnchoredString,
    allStrings: AnchoredString[]
  ): { note: string; frequency: number } {
    if (allStrings.length === 0) {
      const defaultNote = this.scale[0];
      return {
        note: defaultNote,
        frequency: Tone.Frequency(defaultNote).toFrequency(),
      };
    }

    // Sort strings by horizontal center: (P1.x + P2.x) / 2
    const sorted = [...allStrings].sort((a, b) => {
      const aMidX = (a.point1.x + a.point2.x) * 0.5;
      const bMidX = (b.point1.x + b.point2.x) * 0.5;
      return aMidX - bMidX;
    });

    const index = sorted.findIndex((s) => s.id === targetString.id);
    const scaleIndex = index !== -1 ? index % this.scale.length : 0;
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
