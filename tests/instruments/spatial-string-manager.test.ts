import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { SpatialStringManager } from '../../src/instruments/spatial-string-manager';
import { HandGestureState } from '../../src/types/gestures';
import { SceneManager } from '../../src/render/scene-manager';
import { globalBus } from '../../src/core/event-bus';
import { ChargePopEvent } from '../../src/types/instruments';

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

describe('SpatialStringManager — Single-Hand Creation & Multi-Hand Endpoint Manipulation', () => {
  let manager: SpatialStringManager;

  beforeEach(() => {
    manager = new SpatialStringManager(createMockSceneManager(), {
      minAnchorDistance: 0.10,
      minStretchDurationMs: 150,
      chargeDurationMs: 400,
      maxChargeMoveDistance: 0.06,
      releaseGraceMs: 100,
      cooldownMs: 300,
      grabProximityThreshold: 0.045,
      grabPinchDistance: 0.052,
      grabDwellMs: 35,
      maxGrabHandSpeed: 1.1,
    });
  });

  it('requires holding a steady pinch to charge & pop before dragging a string', () => {
    let popCount = 0;
    const unsub = globalBus.on<ChargePopEvent>('string:charge_pop', () => {
      popCount++;
    });

    // Start pinch at Point A (0.2, 0.5) -> begins charging, not stretching yet
    manager.update([makeGesture(0, true, 0.2, 0.5)], 16 / 9, 1000);
    expect(manager.isChargingAnchor).toBe(true);
    expect(manager.isDrawingString).toBe(false);

    // Mid-charge at 200ms -> ~50% progress
    manager.update([makeGesture(0, true, 0.21, 0.5)], 16 / 9, 1200);
    const midPreview = manager.getPreviewState();
    expect(midPreview.isCharging).toBe(true);
    expect(midPreview.chargeProgress).toBeCloseTo(0.5);
    expect(popCount).toBe(0);

    // Complete charge at 410ms -> POPS and locks Point A!
    manager.update([makeGesture(0, true, 0.21, 0.5)], 16 / 9, 1410);
    expect(manager.isChargingAnchor).toBe(false);
    expect(manager.isDrawingString).toBe(true);
    expect(popCount).toBe(1);

    // Drag to Point B (0.7, 0.5) after 200ms
    manager.update([makeGesture(0, true, 0.7, 0.5)], 16 / 9, 1610);
    const preview = manager.getPreviewState();
    expect(preview.isActive).toBe(true);
    expect(preview.point1?.x).toBeCloseTo(0.2);
    expect(preview.point2?.x).toBeCloseTo(0.7);

    // Release pinch -> anchors after releaseGraceMs
    manager.update([makeGesture(0, false, 0.7, 0.5)], 16 / 9, 1650);
    const anchored = manager.update([makeGesture(0, false, 0.7, 0.5)], 16 / 9, 1760);
    expect(anchored).not.toBeNull();
    expect(manager.count).toBe(1);
    expect(anchored?.point1.x).toBeCloseTo(0.2);
    expect(anchored?.point2.x).toBeCloseTo(0.7);

    unsub();
  });

  it('resets charge if hand moves rapidly (prevents accidental creation while strumming)', () => {
    manager.update([makeGesture(0, true, 0.2, 0.5)], 16 / 9, 1000);
    // Hand sweeps across frame (> maxChargeMoveDistance 0.06) at 300ms
    manager.update([makeGesture(0, true, 0.45, 0.5)], 16 / 9, 1300);
    expect(manager.isDrawingString).toBe(false);
    expect(manager.isChargingAnchor).toBe(true);
    expect(manager.getPreviewState().chargeProgress).toBe(0);

    // Releasing at 450ms (only 150ms since reset) cancels cleanly with 0 strings
    manager.update([makeGesture(0, false, 0.45, 0.5)], 16 / 9, 1450);
    expect(manager.isChargingAnchor).toBe(false);
    expect(manager.isDrawingString).toBe(false);
    expect(manager.count).toBe(0);
  });

  it('grabs an existing endpoint with one hand while leaving the other hand free to play', () => {
    // Charge & anchor first string from (0.2, 0.5) to (0.7, 0.5)
    manager.update([makeGesture(0, true, 0.2, 0.5)], 16 / 9, 1000);
    manager.update([makeGesture(0, true, 0.2, 0.5)], 16 / 9, 1450);
    manager.update([makeGesture(0, true, 0.7, 0.5)], 16 / 9, 1650);
    manager.update([makeGesture(0, false, 0.7, 0.5)], 16 / 9, 1700);
    manager.update([makeGesture(0, false, 0.7, 0.5)], 16 / 9, 1850);
    expect(manager.count).toBe(1);

    // Hand 0 grabs p1 (0.2, 0.5) while Hand 1 is open in the middle of the string
    manager.update([makeGesture(0, false, 0.2, 0.5), makeGesture(1, false, 0.45, 0.5)], 16 / 9, 2300);
    manager.update([makeGesture(0, true, 0.2, 0.5, 0, 0.02), makeGesture(1, false, 0.45, 0.5)], 16 / 9, 2320);
    manager.update([makeGesture(0, true, 0.2, 0.5, 0, 0.02), makeGesture(1, false, 0.45, 0.5)], 16 / 9, 2370);

    const grabs = manager.getActiveGrabs();
    expect(grabs).toHaveLength(1);
    expect(grabs[0].handId).toBe(0);
    expect(grabs[0].endpoint).toBe('p1');
    expect(manager.isChargingAnchor).toBe(false);
    expect(manager.isDrawingString).toBe(false);
  });

  it('supports resizing both string tips simultaneously with two hands', () => {
    // Anchor first string from (0.2, 0.5) to (0.7, 0.5)
    manager.update([makeGesture(0, true, 0.2, 0.5)], 16 / 9, 1000);
    manager.update([makeGesture(0, true, 0.2, 0.5)], 16 / 9, 1450);
    manager.update([makeGesture(0, true, 0.7, 0.5)], 16 / 9, 1650);
    manager.update([makeGesture(0, false, 0.7, 0.5)], 16 / 9, 1700);
    manager.update([makeGesture(0, false, 0.7, 0.5)], 16 / 9, 1850);

    // Both hands approach p1 and p2 unpinched, then pinch & dwell
    manager.update([makeGesture(0, false, 0.2, 0.5), makeGesture(1, false, 0.7, 0.5)], 16 / 9, 2300);
    manager.update([makeGesture(0, true, 0.2, 0.5, 0, 0.02), makeGesture(1, true, 0.7, 0.5, 0, 0.02)], 16 / 9, 2320);
    manager.update([makeGesture(0, true, 0.2, 0.5, 0, 0.02), makeGesture(1, true, 0.7, 0.5, 0, 0.02)], 16 / 9, 2370);

    expect(manager.getActiveGrabs()).toHaveLength(2);

    // Stretch outward with both hands
    manager.update([makeGesture(0, true, 0.1, 0.5, 0, 0.02), makeGesture(1, true, 0.85, 0.5, 0, 0.02)], 16 / 9, 2450);
    const updated = manager.getStrings()[0];
    expect(updated.point1.x).toBeCloseTo(0.1);
    expect(updated.point2.x).toBeCloseTo(0.85);
  });
});
