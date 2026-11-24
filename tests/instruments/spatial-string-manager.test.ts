import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { SpatialStringManager } from '../../src/instruments/spatial-string-manager';
import { DualPinchState, HandGestureState } from '../../src/types/gestures';
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

const NO_DUAL_PINCH: DualPinchState = { isDualPinch: false, distance: 0 };

describe('SpatialStringManager — Charge-to-Pop, One-Hand, Two-Hand & Lock Modes', () => {
  let manager: SpatialStringManager;

  beforeEach(() => {
    manager = new SpatialStringManager(createMockSceneManager(), {
      handMode: 'one-hand',
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

  it('requires holding a steady pinch to charge & pop before dragging a string in one-hand mode', () => {
    let popCount = 0;
    const unsub = globalBus.on<ChargePopEvent>('string:charge_pop', () => {
      popCount++;
    });

    // Start pinch at Point A (0.2, 0.5) -> begins charging, not stretching yet
    manager.update([makeGesture(0, true, 0.2, 0.5)], NO_DUAL_PINCH, 16 / 9, 1000);
    expect(manager.isChargingAnchor).toBe(true);
    expect(manager.isDrawingString).toBe(false);

    // Mid-charge at 200ms -> ~50% progress
    manager.update([makeGesture(0, true, 0.21, 0.5)], NO_DUAL_PINCH, 16 / 9, 1200);
    const midPreview = manager.getPreviewState(NO_DUAL_PINCH);
    expect(midPreview.isCharging).toBe(true);
    expect(midPreview.chargeProgress).toBeCloseTo(0.5);
    expect(popCount).toBe(0);

    // Complete charge at 410ms -> POPS and locks Point A!
    manager.update([makeGesture(0, true, 0.21, 0.5)], NO_DUAL_PINCH, 16 / 9, 1410);
    expect(manager.isChargingAnchor).toBe(false);
    expect(manager.isDrawingString).toBe(true);
    expect(popCount).toBe(1);

    // Drag to Point B (0.7, 0.5) after 200ms
    manager.update([makeGesture(0, true, 0.7, 0.5)], NO_DUAL_PINCH, 16 / 9, 1610);
    const preview = manager.getPreviewState(NO_DUAL_PINCH);
    expect(preview.isActive).toBe(true);
    expect(preview.point1?.x).toBeCloseTo(0.2);
    expect(preview.point2?.x).toBeCloseTo(0.7);

    // Release pinch -> anchors after releaseGraceMs
    manager.update([makeGesture(0, false, 0.7, 0.5)], NO_DUAL_PINCH, 16 / 9, 1650);
    const anchored = manager.update([makeGesture(0, false, 0.7, 0.5)], NO_DUAL_PINCH, 16 / 9, 1760);
    expect(anchored).not.toBeNull();
    expect(manager.count).toBe(1);
    expect(anchored?.point1.x).toBeCloseTo(0.2);
    expect(anchored?.point2.x).toBeCloseTo(0.7);

    unsub();
  });

  it('resets charge if hand moves rapidly (prevents accidental creation while strumming)', () => {
    manager.update([makeGesture(0, true, 0.2, 0.5)], NO_DUAL_PINCH, 16 / 9, 1000);
    // Hand sweeps across frame (> maxChargeMoveDistance 0.06) at 300ms
    manager.update([makeGesture(0, true, 0.45, 0.5)], NO_DUAL_PINCH, 16 / 9, 1300);
    expect(manager.isDrawingString).toBe(false);
    expect(manager.isChargingAnchor).toBe(true);
    expect(manager.getPreviewState(NO_DUAL_PINCH).chargeProgress).toBe(0);

    // Releasing at 450ms (only 150ms since reset) cancels cleanly with 0 strings
    manager.update([makeGesture(0, false, 0.45, 0.5)], NO_DUAL_PINCH, 16 / 9, 1450);
    expect(manager.isChargingAnchor).toBe(false);
    expect(manager.isDrawingString).toBe(false);
    expect(manager.count).toBe(0);
  });

  it('grabs an existing endpoint instead of charging a new string when pinching on a tip', () => {
    // Charge & anchor first string from (0.2, 0.5) to (0.7, 0.5)
    manager.update([makeGesture(0, true, 0.2, 0.5)], NO_DUAL_PINCH, 16 / 9, 1000);
    manager.update([makeGesture(0, true, 0.2, 0.5)], NO_DUAL_PINCH, 16 / 9, 1450);
    manager.update([makeGesture(0, true, 0.7, 0.5)], NO_DUAL_PINCH, 16 / 9, 1650);
    manager.update([makeGesture(0, false, 0.7, 0.5)], NO_DUAL_PINCH, 16 / 9, 1700);
    manager.update([makeGesture(0, false, 0.7, 0.5)], NO_DUAL_PINCH, 16 / 9, 1850);
    expect(manager.count).toBe(1);

    // Move near p1 (0.2, 0.5) unpinched, then pinch & hold for grabDwellMs
    manager.update([makeGesture(0, false, 0.2, 0.5)], NO_DUAL_PINCH, 16 / 9, 2300);
    manager.update([makeGesture(0, true, 0.2, 0.5, 0, 0.02)], NO_DUAL_PINCH, 16 / 9, 2320);
    manager.update([makeGesture(0, true, 0.2, 0.5, 0, 0.02)], NO_DUAL_PINCH, 16 / 9, 2370);

    expect(manager.isAnyEndpointGrabbed).toBe(true);
    expect(manager.isChargingAnchor).toBe(false);
    expect(manager.isDrawingString).toBe(false);
    expect(manager.count).toBe(1);
  });

  it('supports charge-to-pop dual-pinch anchoring in two-hand mode', () => {
    manager.setHandMode('two-hand');

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

    // Start dual pinch -> charging
    manager.update([g1, g2], dual, 16 / 9, 1000);
    expect(manager.isChargingAnchor).toBe(true);
    expect(manager.isDrawingString).toBe(false);

    // Hold steady past chargeDurationMs -> pops & arms elastic string
    manager.update([g1, g2], dual, 16 / 9, 1450);
    expect(manager.isChargingAnchor).toBe(false);
    expect(manager.isDrawingString).toBe(true);

    // Stretch & release
    manager.update([g1, g2], dual, 16 / 9, 1650);
    manager.update([makeGesture(0, false, 0.2, 0.5), makeGesture(1, false, 0.8, 0.5)], NO_DUAL_PINCH, 16 / 9, 1700);
    const anchored = manager.update(
      [makeGesture(0, false, 0.2, 0.5), makeGesture(1, false, 0.8, 0.5)],
      NO_DUAL_PINCH,
      16 / 9,
      1850
    );

    expect(anchored).not.toBeNull();
    expect(manager.count).toBe(1);
  });

  it('blocks string creation and tip grabbing when harp is locked (Play Mode)', () => {
    manager.setLocked(true);
    expect(manager.getIsLocked()).toBe(true);

    manager.update([makeGesture(0, true, 0.2, 0.5)], NO_DUAL_PINCH, 16 / 9, 1000);
    manager.update([makeGesture(0, true, 0.2, 0.5)], NO_DUAL_PINCH, 16 / 9, 1500);
    expect(manager.isChargingAnchor).toBe(false);
    expect(manager.isDrawingString).toBe(false);
    expect(manager.count).toBe(0);
  });

  it('resets in-progress charge cleanly when switching hand modes', () => {
    manager.update([makeGesture(0, true, 0.2, 0.5)], NO_DUAL_PINCH, 16 / 9, 1000);
    expect(manager.isChargingAnchor).toBe(true);

    manager.setHandMode('two-hand');
    expect(manager.isChargingAnchor).toBe(false);
    expect(manager.isDrawingString).toBe(false);
  });
});
