import { describe, it, expect, beforeEach } from 'vitest';
import { StringCollisionDetector } from '../../src/gestures/string-collision-detector';
import { ScaleMapper } from '../../src/audio/scale-mapper';
import { AnchoredString } from '../../src/types/instruments';
import { HandPose, Point3D } from '../../src/types/vision';

describe('StringCollisionDetector', () => {
  let detector: StringCollisionDetector;
  let scaleMapper: ScaleMapper;

  const createString = (id: string, x1: number, y1: number, x2: number, y2: number): AnchoredString => ({
    id,
    index: 0,
    point1: { x: x1, y: y1, z: 0 },
    point2: { x: x2, y: y2, z: 0 },
    length: Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
    color: 0x00f0ff,
    note: 'C4',
    frequency: 261.63,
    createdAt: 0,
  });

  const createHandWithIndex = (id: number, pos: Point3D): HandPose => {
    const landmarks: Point3D[] = new Array(21).fill({ x: 0, y: 0, z: 0 });
    landmarks[8] = pos; // index fingertip
    return {
      id,
      handedness: 'Right',
      landmarks,
      worldLandmarks: landmarks,
    };
  };

  beforeEach(() => {
    scaleMapper = new ScaleMapper('pentatonic');
    detector = new StringCollisionDetector(scaleMapper);
    detector.configure({
      retriggerCooldownMs: 100,
      stringCooldownMs: 80,
    });
  });

  it('returns empty array when there are no strings or hands', () => {
    const plucks1 = detector.update([], [], 0.016, 1000);
    expect(plucks1).toEqual([]);

    const string = createString('s1', 0.2, 0.5, 0.8, 0.5);
    const plucks2 = detector.update([], [string], 0.016, 1000);
    expect(plucks2).toEqual([]);
  });

  it('detects a pluck when a fingertip trajectory crosses an anchored string', () => {
    // Horizontal string across the center: y = 0.5, x from 0.2 to 0.8
    const string = createString('s1', 0.2, 0.5, 0.8, 0.5);

    // Frame 1: Finger above string at (0.4, 0.45)
    const handFrame1 = createHandWithIndex(1, { x: 0.4, y: 0.45, z: 0 });
    detector.update([handFrame1], [string], 0.016, 1000);

    // Frame 2: Finger moves downward across string to (0.4, 0.55)
    const handFrame2 = createHandWithIndex(1, { x: 0.4, y: 0.55, z: 0 });
    const plucks = detector.update([handFrame2], [string], 0.016, 1016);

    expect(plucks.length).toBe(1);
    const pluck = plucks[0];
    expect(pluck.stringId).toBe('s1');
    expect(pluck.handId).toBe(1);
    expect(pluck.fingerIndex).toBe(8);
    expect(pluck.velocity).toBeGreaterThanOrEqual(0.35);
    expect(typeof pluck.note).toBe('string');
  });

  it('ignores hands specified in ignoreHandIds (e.g. actively grabbing)', () => {
    const string = createString('s1', 0.2, 0.5, 0.8, 0.5);

    // Establish previous position
    detector.update([createHandWithIndex(1, { x: 0.4, y: 0.45, z: 0 })], [string], 0.016, 1000);

    // Cross string but hand 1 is in ignoreHandIds set
    const plucks = detector.update(
      [createHandWithIndex(1, { x: 0.4, y: 0.55, z: 0 })],
      [string],
      0.016,
      1016,
      new Set([1])
    );

    expect(plucks.length).toBe(0);
  });

  it('enforces retrigger cooldown to prevent chatter plucking', () => {
    const string = createString('s1', 0.2, 0.5, 0.8, 0.5);

    // First pluck
    detector.update([createHandWithIndex(1, { x: 0.4, y: 0.45, z: 0 })], [string], 0.016, 1000);
    const plucks1 = detector.update([createHandWithIndex(1, { x: 0.4, y: 0.55, z: 0 })], [string], 0.016, 1016);
    expect(plucks1.length).toBe(1);

    // Immediate second cross within 20ms (< 100ms cooldown)
    detector.update([createHandWithIndex(1, { x: 0.4, y: 0.55, z: 0 })], [string], 0.016, 1020);
    const plucks2 = detector.update([createHandWithIndex(1, { x: 0.4, y: 0.45, z: 0 })], [string], 0.016, 1030);
    expect(plucks2.length).toBe(0);
  });

  it('clears state on reset()', () => {
    detector.reset();
    expect(detector.update([], [], 0.016, 1000)).toEqual([]);
  });
});
