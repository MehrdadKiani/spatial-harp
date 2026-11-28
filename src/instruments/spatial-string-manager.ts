import { HandGestureState } from '../types/gestures';
import {
  AnchoredString,
  ChargePopEvent,
  EndpointGrabState,
  SpatialStringConfig,
  StringPreviewState,
} from '../types/instruments';
import { Point3D } from '../types/vision';
import { SceneManager } from '../render/scene-manager';
import { globalBus } from '../core/event-bus';

// Harmonious laser color palette (Cyan, Emerald, Violet, Neon Pink, Amber, Sky Blue, Lime, Purple)
const STRING_PALETTE = [
  0x00f0ff, // Neon Cyan
  0x38ef7d, // Emerald Green
  0x9b51e0, // Royal Violet
  0xff007f, // Laser Pink
  0xffaa00, // Golden Amber
  0x00e5ff, // Deep Sky
  0x76ff03, // Electric Lime
  0xe040fb, // Magenta
];

interface PendingGrabCandidate {
  handId: number;
  stringId: string;
  endpoint: 'p1' | 'p2';
  startTimeMs: number;
}

export class SpatialStringManager {
  private strings: AnchoredString[] = [];
  private sceneManager: SceneManager;
  private maxStrings: number;
  private minAnchorDistance: number;
  private minStretchDurationMs: number;
  private chargeDurationMs: number;
  private maxChargeMoveDistance: number;
  private releaseGraceMs: number;
  private cooldownMs: number;
  private grabProximityThreshold: number;
  private grabPinchDistance: number;
  private grabDwellMs: number;
  private maxGrabHandSpeed: number;
  private palette: number[];

  // Active endpoint grabs (handId -> EndpointGrabState); supports 1-hand or simultaneous 2-hand resizing
  private activeGrabs = new Map<number, EndpointGrabState>();

  // Intentional grab verification state (edge-triggered pinch + velocity guard + dwell timer)
  private pendingGrabs = new Map<number, PendingGrabCandidate>();
  private wasHandPinching = new Map<number, boolean>();
  private pinchStartedAwayFromTip = new Map<number, boolean>();
  private prevHandSamples = new Map<number, { x: number; y: number; z: number; timeMs: number }>();

  // Charge-to-pop & anchoring state machine with debounce & flicker suppression
  private isCharging = false;
  private chargeStartTime = 0;
  private chargeProgress = 0;
  private chargeOrigin1: Point3D | null = null;
  private chargeCurrent1: Point3D | null = null;

  private isStretching = false;
  private drawingHandId: number | null = null;
  private stretchStartTime = 0;
  private releaseStartTime = 0;
  private lastAnchorTime = 0;
  private lastPoint1: Point3D | null = null;
  private lastPoint2: Point3D | null = null;
  private nextId = 1;

  // Pre-allocated preview state objects (zero-GC inside RAF tick)
  private previewP1: Point3D = { x: 0, y: 0, z: 0 };
  private previewP2: Point3D = { x: 0, y: 0, z: 0 };
  private previewChargeP1: Point3D = { x: 0, y: 0, z: 0 };
  private previewState: StringPreviewState = {
    isActive: false,
    isCharging: false,
    chargeProgress: 0,
  };

  constructor(sceneManager: SceneManager, config: SpatialStringConfig = {}) {
    this.sceneManager = sceneManager;
    this.maxStrings = config.maxStrings ?? 12;
    this.minAnchorDistance = config.minAnchorDistance ?? 0.10;
    this.minStretchDurationMs = config.minStretchDurationMs ?? 150;
    this.chargeDurationMs = config.chargeDurationMs ?? 450;
    this.maxChargeMoveDistance = config.maxChargeMoveDistance ?? 0.065;
    this.releaseGraceMs = config.releaseGraceMs ?? 120;
    this.cooldownMs = config.cooldownMs ?? 350;
    this.grabProximityThreshold = config.grabProximityThreshold ?? 0.045;
    this.grabPinchDistance = config.grabPinchDistance ?? 0.052;
    this.grabDwellMs = config.grabDwellMs ?? 35;
    this.maxGrabHandSpeed = config.maxGrabHandSpeed ?? 1.10;
    this.palette = config.palette && config.palette.length > 0 ? config.palette : STRING_PALETTE;
  }

  public configure(config: SpatialStringConfig): void {
    if (config.maxStrings !== undefined) this.maxStrings = config.maxStrings;
    if (config.minAnchorDistance !== undefined) this.minAnchorDistance = config.minAnchorDistance;
    if (config.minStretchDurationMs !== undefined) this.minStretchDurationMs = config.minStretchDurationMs;
    if (config.chargeDurationMs !== undefined) this.chargeDurationMs = config.chargeDurationMs;
    if (config.maxChargeMoveDistance !== undefined) this.maxChargeMoveDistance = config.maxChargeMoveDistance;
    if (config.releaseGraceMs !== undefined) this.releaseGraceMs = config.releaseGraceMs;
    if (config.cooldownMs !== undefined) this.cooldownMs = config.cooldownMs;
    if (config.grabProximityThreshold !== undefined) this.grabProximityThreshold = config.grabProximityThreshold;
    if (config.grabPinchDistance !== undefined) this.grabPinchDistance = config.grabPinchDistance;
    if (config.grabDwellMs !== undefined) this.grabDwellMs = config.grabDwellMs;
    if (config.maxGrabHandSpeed !== undefined) this.maxGrabHandSpeed = config.maxGrabHandSpeed;
    if (config.palette && config.palette.length > 0) this.palette = config.palette;
  }

  private resetCreationState(): void {
    this.isCharging = false;
    this.chargeStartTime = 0;
    this.chargeProgress = 0;
    this.chargeOrigin1 = null;
    this.chargeCurrent1 = null;
    this.isStretching = false;
    this.drawingHandId = null;
    this.releaseStartTime = 0;
    this.lastPoint1 = null;
    this.lastPoint2 = null;
  }

  public update(
    gestureStates: HandGestureState[],
    videoAspect: number,
    nowMs: number
  ): AnchoredString | null {
    let newlyAnchored: AnchoredString | null = null;

    // 1. Process active endpoint grabs (supports 1-hand or simultaneous 2-hand moving/resizing)
    for (const [handId, grab] of Array.from(this.activeGrabs.entries())) {
      const gesture = gestureStates.find((g) => g.handId === handId);
      const targetString = this.strings.find((s) => s.id === grab.stringId);

      if (!gesture || !gesture.pinch.isPinching || !targetString) {
        this.activeGrabs.delete(handId);
        this.pendingGrabs.delete(handId);
        globalBus.emit('string:reanchored', { stringId: grab.stringId, endpoint: grab.endpoint });
      } else {
        const pt = gesture.pinch.pinchPoint;
        if (grab.endpoint === 'p1') {
          targetString.point1 = { ...pt };
          const w1 = this.sceneManager.toWorldCoords(pt.x, pt.y, pt.z, videoAspect);
          targetString.worldP1 = { x: w1.x, y: w1.y, z: w1.z };
        } else {
          targetString.point2 = { ...pt };
          const w2 = this.sceneManager.toWorldCoords(pt.x, pt.y, pt.z, videoAspect);
          targetString.worldP2 = { x: w2.x, y: w2.y, z: w2.z };
        }

        const p1World = this.sceneManager.toWorldCoords(targetString.point1.x, targetString.point1.y, targetString.point1.z, videoAspect);
        const p2World = this.sceneManager.toWorldCoords(targetString.point2.x, targetString.point2.y, targetString.point2.z, videoAspect);
        targetString.length = p1World.distanceTo(p2World);
      }
    }

    // 2. Check for intentional new endpoint grabs (3-layer anti-snag guard)
    const seenHandIds = new Set<number>();

    gestureStates.forEach((gesture) => {
      const handId = gesture.handId;
      seenHandIds.add(handId);

      const pinchPt = gesture.pinch.pinchPoint;
      const isPinching = gesture.pinch.isPinching;
      const isFirmPinch = isPinching && gesture.pinch.distance <= this.grabPinchDistance;
      const wasPinching = this.wasHandPinching.get(handId) || false;

      let handSpeed = 0;
      const prevSample = this.prevHandSamples.get(handId);
      if (prevSample) {
        const dtSec = (nowMs - prevSample.timeMs) * 0.001;
        if (dtSec > 0.004) {
          const vx = pinchPt.x - prevSample.x;
          const vy = pinchPt.y - prevSample.y;
          const vz = (pinchPt.z - prevSample.z) * 0.5;
          const dist = Math.sqrt(vx * vx + vy * vy + vz * vz);
          if (dist > 1e-5) {
            handSpeed = dist / dtSec;
            this.prevHandSamples.set(handId, { x: pinchPt.x, y: pinchPt.y, z: pinchPt.z, timeMs: nowMs });
          }
        }
      } else {
        this.prevHandSamples.set(handId, { x: pinchPt.x, y: pinchPt.y, z: pinchPt.z, timeMs: nowMs });
      }

      let closestDist = Infinity;
      let minAnyTipDist = Infinity;
      let closestTarget: { stringId: string; endpoint: 'p1' | 'p2' } | null = null;

      // Measure 2D screen-plane distance to string endpoints (ignoring camera Z depth drift)
      this.strings.forEach((str) => {
        const dx1 = pinchPt.x - str.point1.x;
        const dy1 = pinchPt.y - str.point1.y;
        const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

        if (dist1 < minAnyTipDist) {
          minAnyTipDist = dist1;
        }
        if (dist1 <= this.grabProximityThreshold && dist1 < closestDist) {
          closestDist = dist1;
          closestTarget = { stringId: str.id, endpoint: 'p1' };
        }

        const dx2 = pinchPt.x - str.point2.x;
        const dy2 = pinchPt.y - str.point2.y;
        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        if (dist2 < minAnyTipDist) {
          minAnyTipDist = dist2;
        }
        if (dist2 <= this.grabProximityThreshold && dist2 < closestDist) {
          closestDist = dist2;
          closestTarget = { stringId: str.id, endpoint: 'p2' };
        }
      });

      if (!isPinching) {
        this.pinchStartedAwayFromTip.set(handId, false);
        this.pendingGrabs.delete(handId);
      } else if (!wasPinching && isPinching) {
        // Only reject if pinch started far away in the middle of the harp (> 2.2x grab radius)
        const startedNearAnyTip = minAnyTipDist <= Math.max(0.095, this.grabProximityThreshold * 2.2);
        this.pinchStartedAwayFromTip.set(handId, !startedNearAnyTip);
      }

      this.wasHandPinching.set(handId, isPinching);

      if (this.activeGrabs.has(handId) || this.pinchStartedAwayFromTip.get(handId)) {
        this.pendingGrabs.delete(handId);
        return;
      }

      if (isFirmPinch && closestTarget && handSpeed <= this.maxGrabHandSpeed) {
        const target = closestTarget as { stringId: string; endpoint: 'p1' | 'p2' };
        const existingPending = this.pendingGrabs.get(handId);

        if (
          existingPending &&
          existingPending.stringId === target.stringId &&
          existingPending.endpoint === target.endpoint
        ) {
          if (nowMs - existingPending.startTimeMs >= this.grabDwellMs) {
            const confirmedGrab: EndpointGrabState = {
              handId,
              stringId: target.stringId,
              endpoint: target.endpoint,
            };
            this.activeGrabs.set(handId, confirmedGrab);
            this.pendingGrabs.delete(handId);
            globalBus.emit('string:grabbed', confirmedGrab);
          }
        } else {
          this.pendingGrabs.set(handId, {
            handId,
            stringId: target.stringId,
            endpoint: target.endpoint,
            startTimeMs: nowMs,
          });
        }
      } else {
        this.pendingGrabs.delete(handId);
      }
    });

    for (const handId of Array.from(this.pendingGrabs.keys())) {
      if (!seenHandIds.has(handId)) {
        this.pendingGrabs.delete(handId);
      }
    }

    // 3. Single-hand String Creation State Machine (Hold-to-Charge -> Pop -> Drag -> Release)
    if (this.activeGrabs.size > 0 || this.pendingGrabs.size > 0) {
      this.resetCreationState();
      return null;
    }

    const dist2D = (a: Point3D, b: Point3D): number => {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const pinchingHand =
      this.drawingHandId !== null
        ? gestureStates.find((g) => g.handId === this.drawingHandId && g.pinch.isPinching)
        : gestureStates.find((g) => g.pinch.isPinching);

    if (pinchingHand) {
      if (this.releaseStartTime > 0) {
        this.releaseStartTime = 0;
      }

      if (this.isStretching) {
        this.lastPoint2 = { ...pinchingHand.pinch.pinchPoint };
      } else if (nowMs - this.lastAnchorTime >= this.cooldownMs) {
        if (this.chargeDurationMs <= 0) {
          this.isStretching = true;
          this.drawingHandId = pinchingHand.handId;
          this.stretchStartTime = nowMs;
          this.lastPoint1 = { ...pinchingHand.pinch.pinchPoint };
          this.lastPoint2 = { ...pinchingHand.pinch.pinchPoint };
          const popEvent: ChargePopEvent = {
            point1: { ...this.lastPoint1 },
          };
          globalBus.emit('string:charge_pop', popEvent);
        } else if (!this.isCharging) {
          this.isCharging = true;
          this.drawingHandId = pinchingHand.handId;
          this.chargeStartTime = nowMs;
          this.chargeProgress = 0;
          this.chargeOrigin1 = { ...pinchingHand.pinch.pinchPoint };
          this.chargeCurrent1 = { ...pinchingHand.pinch.pinchPoint };
        } else if (this.chargeOrigin1) {
          const pt = pinchingHand.pinch.pinchPoint;
          this.chargeCurrent1 = { ...pt };
          if (dist2D(pt, this.chargeOrigin1) > this.maxChargeMoveDistance) {
            this.chargeStartTime = nowMs;
            this.chargeProgress = 0;
            this.chargeOrigin1 = { ...pt };
          } else {
            const elapsed = nowMs - this.chargeStartTime;
            this.chargeProgress = Math.max(0, Math.min(1, elapsed / this.chargeDurationMs));
            if (elapsed >= this.chargeDurationMs) {
              const lockedP1 = { ...this.chargeOrigin1 };
              this.isCharging = false;
              this.chargeProgress = 0;
              this.chargeOrigin1 = null;
              this.chargeCurrent1 = null;
              this.isStretching = true;
              this.stretchStartTime = nowMs;
              this.lastPoint1 = lockedP1;
              this.lastPoint2 = { ...pt };
              const popEvent: ChargePopEvent = {
                point1: { ...lockedP1 },
              };
              globalBus.emit('string:charge_pop', popEvent);
            }
          }
        }
      }
    } else if (this.isCharging) {
      this.resetCreationState();
    } else if (this.isStretching && this.lastPoint1 && this.lastPoint2) {
      if (this.releaseStartTime === 0) {
        this.releaseStartTime = nowMs;
      } else if (nowMs - this.releaseStartTime >= this.releaseGraceMs) {
        const stretchDuration = this.releaseStartTime - this.stretchStartTime;

        const dx = this.lastPoint1.x - this.lastPoint2.x;
        const dy = this.lastPoint1.y - this.lastPoint2.y;
        const dz = (this.lastPoint1.z - this.lastPoint2.z) * 0.5;
        const normDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (normDistance >= this.minAnchorDistance && stretchDuration >= this.minStretchDurationMs) {
          newlyAnchored = this.anchorString(this.lastPoint1, this.lastPoint2, videoAspect, nowMs);
          this.lastAnchorTime = nowMs;
        }

        this.resetCreationState();
      }
    }

    return newlyAnchored;
  }

  private anchorString(
    p1: Point3D,
    p2: Point3D,
    videoAspect: number,
    nowMs: number
  ): AnchoredString {
    const worldP1 = this.sceneManager.toWorldCoords(p1.x, p1.y, p1.z, videoAspect);
    const worldP2 = this.sceneManager.toWorldCoords(p2.x, p2.y, p2.z, videoAspect);

    const length = worldP1.distanceTo(worldP2);
    const color = this.palette[this.strings.length % this.palette.length];

    const anchored: AnchoredString = {
      id: `str_${this.nextId++}`,
      index: this.strings.length,
      point1: p1,
      point2: p2,
      worldP1: { x: worldP1.x, y: worldP1.y, z: worldP1.z },
      worldP2: { x: worldP2.x, y: worldP2.y, z: worldP2.z },
      length,
      color,
      createdAt: nowMs,
    };

    if (this.strings.length >= this.maxStrings) {
      const removed = this.strings.shift();
      if (removed) {
        globalBus.emit('string:removed', { id: removed.id });
      }
    }

    this.strings.push(anchored);
    this.strings.forEach((s, idx) => (s.index = idx));

    globalBus.emit('string:anchored', anchored);
    return anchored;
  }

  /**
   * Spawns a centered horizontal starter string when the harp is empty so
   * first-time users can pluck and hear sound immediately.
   */
  public spawnStarterString(videoAspect: number, nowMs: number): AnchoredString | null {
    if (this.strings.length > 0) return null;
    return this.anchorString(
      { x: 0.24, y: 0.50, z: 0 },
      { x: 0.76, y: 0.50, z: 0 },
      videoAspect,
      nowMs
    );
  }

  public clearAll(): void {
    const count = this.strings.length;
    this.strings = [];
    this.activeGrabs.clear();
    this.pendingGrabs.clear();
    this.wasHandPinching.clear();
    this.pinchStartedAwayFromTip.clear();
    this.prevHandSamples.clear();
    this.resetCreationState();
    globalBus.emit('string:cleared', { count });
  }

  /**
   * Returns a zero-GC reusable preview state for DynamicStringView.
   */
  public getPreviewState(): StringPreviewState {
    if (this.isCharging && this.chargeCurrent1) {
      this.previewChargeP1.x = this.chargeCurrent1.x;
      this.previewChargeP1.y = this.chargeCurrent1.y;
      this.previewChargeP1.z = this.chargeCurrent1.z;
      this.previewState.isCharging = true;
      this.previewState.chargeProgress = this.chargeProgress;
      this.previewState.chargePoint1 = this.previewChargeP1;
      this.previewState.isActive = false;
      this.previewState.point1 = undefined;
      this.previewState.point2 = undefined;
      this.previewState.drawingHandId = this.drawingHandId ?? undefined;
      return this.previewState;
    }

    this.previewState.isCharging = false;
    this.previewState.chargeProgress = 0;
    this.previewState.chargePoint1 = undefined;

    if (this.isStretching && this.lastPoint1 && this.lastPoint2) {
      this.previewP1.x = this.lastPoint1.x;
      this.previewP1.y = this.lastPoint1.y;
      this.previewP1.z = this.lastPoint1.z;
      this.previewP2.x = this.lastPoint2.x;
      this.previewP2.y = this.lastPoint2.y;
      this.previewP2.z = this.lastPoint2.z;
      this.previewState.isActive = true;
      this.previewState.point1 = this.previewP1;
      this.previewState.point2 = this.previewP2;
      this.previewState.drawingHandId = this.drawingHandId ?? undefined;
    } else {
      this.previewState.isActive = false;
      this.previewState.point1 = undefined;
      this.previewState.point2 = undefined;
      this.previewState.drawingHandId = undefined;
    }

    return this.previewState;
  }

  public getDrawingHandId(): number | null {
    return this.isStretching || this.isCharging ? this.drawingHandId : null;
  }

  public get isDrawingString(): boolean {
    return this.isStretching;
  }

  public get isChargingAnchor(): boolean {
    return this.isCharging;
  }

  public removeString(id: string): void {
    const index = this.strings.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.strings.splice(index, 1);
      this.strings.forEach((s, idx) => (s.index = idx));
      for (const [handId, grab] of this.activeGrabs.entries()) {
        if (grab.stringId === id) {
          this.activeGrabs.delete(handId);
        }
      }
      for (const [handId, pending] of this.pendingGrabs.entries()) {
        if (pending.stringId === id) {
          this.pendingGrabs.delete(handId);
        }
      }
      globalBus.emit('string:removed', { id });
    }
  }

  public getStrings(): AnchoredString[] {
    return this.strings;
  }

  public getActiveGrabs(): EndpointGrabState[] {
    return Array.from(this.activeGrabs.values());
  }

  public get isAnyEndpointGrabbed(): boolean {
    return this.activeGrabs.size > 0;
  }

  public get count(): number {
    return this.strings.length;
  }

  public get maxCapacity(): number {
    return this.maxStrings;
  }
}
