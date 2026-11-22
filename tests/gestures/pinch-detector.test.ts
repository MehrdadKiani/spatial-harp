import { describe, it, expect, beforeEach } from 'vitest';
import { PinchDetector } from '../../src/gestures/pinch-detector';
import { HandPose, Point3D } from '../../src/types/vision';

describe('PinchDetector', () => {
  let detector: PinchDetector;

  const createHand = (id: number, thumbTip: Point3D, indexTip: Point3D): HandPose => {
    const landmarks: Point3D[] = new Array(21).fill({ x: 0, y: 0, z: 0 });
    landmarks[4] = thumbTip;
    landmarks[8] = indexTip;
    return {
      id,
      handedness: 'Right',
      landmarks,
      worldLandmarks: landmarks,
    };
  };

  beforeEach(() => {
    detector = new PinchDetector({
      pinchThreshold: 0.055,
      releaseThreshold: 0.080,
    });
  });

  it('safely handles empty or missing hand landmarks', () => {
    const emptyHand: HandPose = {
      id: 1,
      handedness: 'Right',
      landmarks: [],
      worldLandmarks: [],
    };

    const state = detector.detectHand(emptyHand);
    expect(state.pinch.isPinching).toBe(false);
    expect(state.pinch.distance).toBe(1.0);
    expect(state.pinch.strength).toBe(0);
  });

  it('detects a pinch when distance drops below pinchThreshold', () => {
    // Thumb and index very close (distance = 0.02)
    const hand = createHand(1, { x: 0.5, y: 0.5, z: 0 }, { x: 0.52, y: 0.5, z: 0 });
    const state = detector.detectHand(hand);

    expect(state.pinch.isPinching).toBe(true);
    expect(state.pinch.distance).toBeCloseTo(0.02, 3);
    expect(state.pinch.strength).toBeGreaterThan(0.7);
  });

  it('implements hysteresis latch: remains pinching between thresholds', () => {
    // Step 1: Pinch triggers at distance 0.03 (< 0.055)
    const pinchedHand = createHand(1, { x: 0.5, y: 0.5, z: 0 }, { x: 0.53, y: 0.5, z: 0 });
    expect(detector.detectHand(pinchedHand).pinch.isPinching).toBe(true);

    // Step 2: Distance increases to 0.070 (between 0.055 and 0.080)
    // Hysteresis latch must keep it in pinching state
    const intermediateHand = createHand(1, { x: 0.5, y: 0.5, z: 0 }, { x: 0.57, y: 0.5, z: 0 });
    expect(detector.detectHand(intermediateHand).pinch.isPinching).toBe(true);

    // Step 3: Distance exceeds releaseThreshold 0.080 -> releases pinch
    const releasedHand = createHand(1, { x: 0.5, y: 0.5, z: 0 }, { x: 0.60, y: 0.5, z: 0 });
    expect(detector.detectHand(releasedHand).pinch.isPinching).toBe(false);
  });

  it('detects dual-hand pinch only when both hands are simultaneously pinching', () => {
    const hand1Pinching = createHand(1, { x: 0.2, y: 0.5, z: 0 }, { x: 0.22, y: 0.5, z: 0 });
    const hand2Open = createHand(2, { x: 0.8, y: 0.5, z: 0 }, { x: 0.95, y: 0.5, z: 0 });

    // One pinching, one open
    const singleResult = detector.detectDualPinch([hand1Pinching, hand2Open]);
    expect(singleResult.dualPinch.isDualPinch).toBe(false);

    // Both pinching
    const hand2Pinching = createHand(2, { x: 0.8, y: 0.5, z: 0 }, { x: 0.82, y: 0.5, z: 0 });
    const dualResult = detector.detectDualPinch([hand1Pinching, hand2Pinching]);
    expect(dualResult.dualPinch.isDualPinch).toBe(true);
    expect(dualResult.dualPinch.distance).toBeGreaterThan(0.5);
  });

  it('clears state on reset()', () => {
    const pinchedHand = createHand(1, { x: 0.5, y: 0.5, z: 0 }, { x: 0.52, y: 0.5, z: 0 });
    detector.detectHand(pinchedHand);

    detector.reset();

    // Now test with intermediate distance: should not be pinching because state was reset
    const intermediateHand = createHand(1, { x: 0.5, y: 0.5, z: 0 }, { x: 0.57, y: 0.5, z: 0 });
    expect(detector.detectHand(intermediateHand).pinch.isPinching).toBe(false);
  });
});
