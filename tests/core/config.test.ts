import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, parseHexPalette } from '../../src/core/config';

describe('AppConfig & Utilities', () => {
  it('defines complete, valid DEFAULT_CONFIG groups', () => {
    expect(DEFAULT_CONFIG.vision).toBeDefined();
    expect(DEFAULT_CONFIG.pinch).toBeDefined();
    expect(DEFAULT_CONFIG.strings).toBeDefined();
    expect(DEFAULT_CONFIG.plucking).toBeDefined();
    expect(DEFAULT_CONFIG.audio).toBeDefined();
    expect(DEFAULT_CONFIG.visuals).toBeDefined();
  });

  it('validates default pinch thresholds adhere to hysteresis standard', () => {
    // pinchThreshold MUST be strictly less than releaseThreshold to prevent chatter
    expect(DEFAULT_CONFIG.pinch.pinchThreshold).toBeLessThan(
      DEFAULT_CONFIG.pinch.releaseThreshold
    );
    expect(DEFAULT_CONFIG.pinch.pinchThreshold).toBeGreaterThan(0.01);
    expect(DEFAULT_CONFIG.pinch.releaseThreshold).toBeLessThan(0.20);
  });

  it('validates audio configuration defaults', () => {
    expect(DEFAULT_CONFIG.audio.defaultPreset).toBe('harp');
    expect(DEFAULT_CONFIG.audio.defaultScale).toBe('hirajoshi');
    expect(DEFAULT_CONFIG.audio.polyphony).toBeGreaterThanOrEqual(4);
    expect(DEFAULT_CONFIG.audio.minNormLengthForPitch).toBeLessThan(
      DEFAULT_CONFIG.audio.maxNormLengthForPitch
    );
  });

  it('validates plucking finger indices match standard MediaPipe landmarks', () => {
    // Thumb: 4, Index: 8, Middle: 12, Ring: 16, Pinky: 20
    expect(DEFAULT_CONFIG.plucking.pluckingFingers).toEqual([4, 8, 12, 16, 20]);
    expect(DEFAULT_CONFIG.plucking.touchRadius).toBeLessThan(
      DEFAULT_CONFIG.plucking.releaseRadius
    );
  });

  it('parses diverse hex palette formats correctly into numbers', () => {
    const rawPalette = ['#00f0ff', '0x38ef7d', '#ff007f', 'invalid', '0x9b51e0'];
    const parsed = parseHexPalette(rawPalette);

    expect(parsed).toEqual([0x00f0ff, 0x38ef7d, 0xff007f, 0x9b51e0]);
  });

  it('returns a fallback palette when given an empty or invalid array', () => {
    const fallback = parseHexPalette(['invalid', 'nonsense']);
    expect(fallback.length).toBeGreaterThan(0);
    expect(typeof fallback[0]).toBe('number');
  });
});
