import { describe, it, expect, beforeEach } from 'vitest';
import { ScaleMapper, SCALES } from '../../src/audio/scale-mapper';
import { AnchoredString } from '../../src/types/instruments';

describe('ScaleMapper', () => {
  let mapper: ScaleMapper;

  beforeEach(() => {
    mapper = new ScaleMapper('pentatonic');
  });

  it('initializes with default C Major Pentatonic scale', () => {
    expect(mapper.currentScaleId).toBe('pentatonic');
    expect(mapper.currentScale).toEqual(SCALES.pentatonic.notes);
    expect(mapper.currentScale.length).toBeGreaterThan(10);
  });

  it('supports all 5 defined harmonic scales', () => {
    const scales = mapper.getScales();
    expect(scales.map((s) => s.id)).toEqual([
      'pentatonic',
      'minor',
      'hirajoshi',
      'major',
      'blues',
    ]);

    scales.forEach((scale) => {
      expect(scale.notes.length).toBeGreaterThan(5);
      expect(typeof scale.label).toBe('string');
      expect(typeof scale.description).toBe('string');
    });
  });

  it('switches scales correctly via setScaleById', () => {
    mapper.setScaleById('hirajoshi');
    expect(mapper.currentScaleId).toBe('hirajoshi');
    expect(mapper.currentScale).toEqual(SCALES.hirajoshi.notes);

    mapper.setScaleById('blues');
    expect(mapper.currentScaleId).toBe('blues');
    expect(mapper.currentScale).toEqual(SCALES.blues.notes);
  });

  it('implements Mersennes Law: shorter strings yield higher pitches', () => {
    // Helper to generate mock AnchoredString with specified length
    const createString = (length: number): AnchoredString => ({
      id: 'test-string',
      index: 0,
      point1: { x: 0, y: 0, z: 0 },
      point2: { x: length, y: 0, z: 0 },
      length,
      color: 0x00f0ff,
      note: 'C4',
      frequency: 261.63,
      createdAt: 0,
    });

    const longString = createString(0.85); // long bass string
    const shortString = createString(0.10); // short treble string

    const bassResult = mapper.getNoteForString(longString);
    const trebleResult = mapper.getNoteForString(shortString);

    expect(bassResult.frequency).toBeLessThan(trebleResult.frequency);
    expect(bassResult.note).toBe('C3'); // Lowest note in pentatonic scale
    expect(trebleResult.note).toBe('E6'); // Highest note in pentatonic scale
  });

  it('returns valid acoustic pitch frequencies for notes', () => {
    const string = {
      id: 'test',
      index: 1,
      point1: { x: 0.1, y: 0.2, z: 0 },
      point2: { x: 0.5, y: 0.2, z: 0 },
      length: 0.4,
      color: 0x00f0ff,
      note: 'A4',
      frequency: 440,
      createdAt: 0,
    };

    const result = mapper.getNoteForString(string);
    expect(result.frequency).toBeGreaterThan(60);
    expect(result.frequency).toBeLessThan(2000);
    expect(typeof result.note).toBe('string');
  });

  it('allows custom configuration of length boundaries', () => {
    mapper.configure({
      defaultScale: 'minor',
      minNormLengthForPitch: 0.05,
      maxNormLengthForPitch: 0.95,
    });

    expect(mapper.currentScaleId).toBe('minor');
  });

  it('plays sequential scale notes along a single string in fretted pitch mode', () => {
    mapper.configure({
      defaultScale: 'pentatonic',
      pitchMode: 'fretted',
      fretZones: 5,
    });

    const longString: AnchoredString = {
      id: 'fretted-test',
      index: 0,
      point1: { x: 0.1, y: 0.5, z: 0 },
      point2: { x: 0.9, y: 0.5, z: 0 },
      worldP1: { x: 0.1, y: 0.5, z: 0 },
      worldP2: { x: 0.9, y: 0.5, z: 0 },
      length: 0.8,
      color: 0x00f0ff,
      createdAt: 0,
    };

    const z0 = mapper.getNoteForString(longString, undefined, 0.1);
    const z1 = mapper.getNoteForString(longString, undefined, 0.3);
    const z2 = mapper.getNoteForString(longString, undefined, 0.5);
    const z3 = mapper.getNoteForString(longString, undefined, 0.7);
    const z4 = mapper.getNoteForString(longString, undefined, 0.9);

    expect([z0.note, z1.note, z2.note, z3.note, z4.note]).toEqual(['C3', 'D3', 'E3', 'G3', 'A3']);
    expect(z0.frequency).toBeLessThan(z2.frequency);
    expect(z2.frequency).toBeLessThan(z4.frequency);

    // Reversed draw direction (right->left) still maps left->right low-to-high
    const reversedString: AnchoredString = {
      ...longString,
      point1: { x: 0.9, y: 0.5, z: 0 },
      point2: { x: 0.1, y: 0.5, z: 0 },
    };
    // contactRatio = 0.9 on a right->left string is near the LEFT tip (x ~ 0.18) -> lowest fret
    expect(mapper.getNoteForString(reversedString, undefined, 0.9).note).toBe('C3');
    expect(mapper.getNoteForString(reversedString, undefined, 0.1).note).toBe('A3');
  });
});
