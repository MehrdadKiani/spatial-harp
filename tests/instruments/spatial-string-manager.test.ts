import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { SpatialStringManager } from '../../src/instruments/spatial-string-manager';
import { DualPinchState, HandGestureState } from '../../src/types/gestures';
import { SceneManager } from '../../src/render/scene-manager';

function createMockSceneManager(): SceneManager {
  return {
    toWorldCoords: (x: number, y: number, z: number) => new THREE.Vector3(x, y, z),
  } as unknown as SceneManager;
}

function makeGesture(
  handId: number,
  isPinching: boolean,
  x: number,
  y: number,
  z = 0,
  distance = 0.02
): HandGestureState {
  const pt = { x, y, z };
  return {
    handId,
    handedness: handId === 0 ? 'Right' : 'Left',
    pinch: {
      isPinching,
      pinchPoint: pt,
      distance,
      strength: isPinching ? 0.9 : 0,
    },
    indexTip: pt,
    thumbTip: pt,
  };
}

const NO_DUAL_PINCH: DualPinchState = { isDualPinch: false, distance: 0 };

describe('SpatialStringManager — One-Hand & Two-Hand Modes', () => {
  let manager: SpatialStringManager;

  beforeEach(() => {
    manager = new SpatialStringManager(createMockSceneManager(), {
      handMode: 'one-hand',
      minAnchorDistance: 0.10,
      minStretchDurationMs: 150,
      releaseGraceMs: 100,
      cooldownMs: 300,
      grabProximityThreshold: 0.045,
      grabPinchDistance: 0.052,
      grabDwellMs: 35,
      maxGrabHandSpeed: 1.1,
    });
  });

  it('defaults to one-hand mode and creates a string via pinch-drag-release', () => {
    expect(manager.getHandMode()).toBe('one-hand');

    // Start pinch at Point A (0.2, 0.5)
    manager.update([makeGesture(0, true, 0.2, 0.5)], NO_DUAL_PINCH, 16 / 9, 1000);
    expect(manager.isDrawingString).toBe(true);
    expect(manager.getDrawingHandId()).toBe(0);

    // Drag to Point B (0.7, 0.5) after 200ms
    manager.update([makeGesture(0, true, 0.7, 0.5)], NO_DUAL_PINCH, 16 / 9, 1200);
    const preview = manager.getPreviewState(NO_DUAL_PINCH);
    expect(preview.isActive).toBe(true);
    expect(preview.point1?.x).toBeCloseTo(0.2);
    expect(preview.point2?.x).toBeCloseTo(0.7);

    // Release pinch (starts grace timer)
    manager.update([makeGesture(0, false, 0.7, 0.5)], NO_DUAL_PINCH, 16 / 9, 1250);
    expect(manager.count).toBe(0);

    // After releaseGraceMs (100ms), string anchors!
    const anchored = manager.update([makeGesture(0, false, 0.7, 0.5)], NO_DUAL_PINCH, 16 / 9, 1360);
    expect(anchored).not.toBeNull();
    expect(manager.count).toBe(1);
    expect(anchored?.point1.x).toBeCloseTo(0.2);
    expect(anchored?.point2.x).toBeCloseTo(0.7);
    expect(manager.isDrawingString).toBe(false);
  });

  it('rejects accidental short pinch-drag below minAnchorDistance', () => {
    manager.update([makeGesture(0, true, 0.5, 0.5)], NO_DUAL_PINCH, 16 / 9, 1000);
    manager.update([makeGesture(0, true, 0.53, 0.5)], NO_DUAL_PINCH, 16 / 9, 1250);
    manager.update([makeGesture(0, false, 0.53, 0.5)], NO_DUAL_PINCH, 16 / 9, 1300);
    const anchored = manager.update([makeGesture(0, false, 0.53, 0.5)], NO_DUAL_PINCH, 16 / 9, 1450);

    expect(anchored).toBeNull();
    expect(manager.count).toBe(0);
  });

  it('grabs an existing endpoint instead of drawing a new string when pinching on a tip', () => {
    // Anchor first string from (0.2, 0.5) to (0.7, 0.5)
    manager.update([makeGesture(0, true, 0.2, 0.5)], NO_DUAL_PINCH, 16 / 9, 1000);
    manager.update([makeGesture(0, true, 0.7, 0.5)], NO_DUAL_PINCH, 16 / 9, 1200);
    manager.update([makeGesture(0, false, 0.7, 0.5)], NO_DUAL_PINCH, 16 / 9, 1250);
    manager.update([makeGesture(0, false, 0.7, 0.5)], NO_DUAL_PINCH, 16 / 9, 1400);
    expect(manager.count).toBe(1);

    // Move near p1 (0.2, 0.5) while unpinched, then pinch & hold for grabDwellMs
    manager.update([makeGesture(0, false, 0.2, 0.5)], NO_DUAL_PINCH, 16 / 9, 1900);
    manager.update([makeGesture(0, true, 0.2, 0.5, 0, 0.02)], NO_DUAL_PINCH, 16 / 9, 1920);
    manager.update([makeGesture(0, true, 0.2, 0.5, 0, 0.02)], NO_DUAL_PINCH, 16 / 9, 1970);

    expect(manager.isAnyEndpointGrabbed).toBe(true);
    expect(manager.isDrawingString).toBe(false);
    expect(manager.count).toBe(1);
  });

  it('supports two-hand dual-pinch anchoring when switched to two-hand mode', () => {
    manager.setHandMode('two-hand');
    expect(manager.getHandMode()).toBe('two-hand');

    const g1 = makeGesture(0, true, 0.2, 0.5);
    const g2 = makeGesture(1, true, 0.8, 0.5);
    const dual: DualPinchState = {
      isDualPinch: true,
      hand1: g1,
      hand2: g2,
      point1: g1.pinch.pinchPoint,
      point2: g2.pinch.pinchPoint,
      distance: 0.6,
    };

    manager.update([g1, g2], dual, 16 / 9, 1000);
    manager.update([g1, g2], dual, 16 / 9, 1200);
    manager.update([makeGesture(0, false, 0.2, 0.5), makeGesture(1, false, 0.8, 0.5)], NO_DUAL_PINCH, 16 / 9, 1250);
    const anchored = manager.update(
      [makeGesture(0, false, 0.2, 0.5), makeGesture(1, false, 0.8, 0.5)],
      NO_DUAL_PINCH,
      16 / 9,
      1400
    );

    expect(anchored).not.toBeNull();
    expect(manager.count).toBe(1);
  });

  it('resets in-progress stretch cleanly when switching hand modes', () => {
    manager.update([makeGesture(0, true, 0.2, 0.5)], NO_DUAL_PINCH, 16 / 9, 1000);
    expect(manager.isDrawingString).toBe(true);

    manager.setHandMode('two-hand');
    expect(manager.isDrawingString).toBe(false);
    expect(manager.getDrawingHandId()).toBeNull();
  });
});
