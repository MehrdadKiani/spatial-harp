import * as Tone from 'tone';
import { AnchoredString } from '../types/instruments';

// C Major Pentatonic Scale (2+ octaves: C4 to D6)
// Consonant harmonic scale — any combination of simultaneous notes creates beautiful music
export const PENTATONIC_SCALE = [
  'C4',
  'D4',
  'E4',
  'G4',
  'A4',
  'C5',
  'D5',
  'E5',
  'G5',
  'A5',
  'C6',
  'D6',
];

export class ScaleMapper {
  private scale: string[];

  constructor(scale: string[] = PENTATONIC_SCALE) {
    this.scale = scale;
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

  public setScale(scale: string[]): void {
    if (scale.length > 0) {
      this.scale = scale;
    }
  }

  public get currentScale(): string[] {
    return this.scale;
  }
}
