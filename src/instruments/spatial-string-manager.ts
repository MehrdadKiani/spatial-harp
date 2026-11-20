import { DualPinchState, HandGestureState } from '../types/gestures';
import { AnchoredString, EndpointGrabState, SpatialStringConfig } from '../types/instruments';
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

export class SpatialStringManager {
  private strings: AnchoredString[] = [];
  private sceneManager: SceneManager;
  private maxStrings: number;
  private minAnchorDistance: number;
  private minStretchDurationMs: number;
  private releaseGraceMs: number;
  private cooldownMs: number;
  private grabProximityThreshold: number;

  // Active endpoint grabs (handId -> EndpointGrabState)
  private activeGrabs = new Map<number, EndpointGrabState>();

  // Robust anchoring state machine with debounce & flicker suppression
  private isStretching = false;
  private stretchStartTime = 0;
  private releaseStartTime = 0;
  private lastAnchorTime = 0;
  private lastPoint1: Point3D | null = null;
  private lastPoint2: Point3D | null = null;
  private nextId = 1;

  constructor(sceneManager: SceneManager, config: SpatialStringConfig = {}) {
    this.sceneManager = sceneManager;
    this.maxStrings = config.maxStrings ?? 12;
    this.minAnchorDistance = config.minAnchorDistance ?? 0.10;
    this.minStretchDurationMs = config.minStretchDurationMs ?? 150;
    this.releaseGraceMs = config.releaseGraceMs ?? 120;
    this.cooldownMs = config.cooldownMs ?? 350;
    this.grabProximityThreshold = config.grabProximityThreshold ?? 0.055;
  }

  public update(
    gestureStates: HandGestureState[],
    dualPinch: DualPinchState,
    videoAspect: number,
    nowMs: number
  ): AnchoredString | null {
    let newlyAnchored: AnchoredString | null = null;

    // 1. Process active endpoint grabs
    for (const [handId, grab] of Array.from(this.activeGrabs.entries())) {
      const gesture = gestureStates.find((g) => g.handId === handId);
      const targetString = this.strings.find((s) => s.id === grab.stringId);

      if (!gesture || !gesture.pinch.isPinching || !targetString) {
        // Hand released pinch or string was removed -> end grab
        this.activeGrabs.delete(handId);
        globalBus.emit('string:reanchored', { stringId: grab.stringId, endpoint: grab.endpoint });
      } else {
        // Update the grabbed endpoint position in real time
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

    // 2. Check for new endpoint grabs from pinching hands not already grabbing
    gestureStates.forEach((gesture) => {
      if (gesture.pinch.isPinching && !this.activeGrabs.has(gesture.handId)) {
        const pinchPt = gesture.pinch.pinchPoint;
        let closestDist = Infinity;
        let closestGrab: EndpointGrabState | null = null;

        this.strings.forEach((str) => {
          // Distance to endpoint P1
          const dx1 = pinchPt.x - str.point1.x;
          const dy1 = pinchPt.y - str.point1.y;
          const dz1 = (pinchPt.z - str.point1.z) * 0.5;
          const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1 + dz1 * dz1);

          if (dist1 <= this.grabProximityThreshold && dist1 < closestDist) {
            closestDist = dist1;
            closestGrab = { handId: gesture.handId, stringId: str.id, endpoint: 'p1' };
          }

          // Distance to endpoint P2
          const dx2 = pinchPt.x - str.point2.x;
          const dy2 = pinchPt.y - str.point2.y;
          const dz2 = (pinchPt.z - str.point2.z) * 0.5;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2);

          if (dist2 <= this.grabProximityThreshold && dist2 < closestDist) {
            closestDist = dist2;
            closestGrab = { handId: gesture.handId, stringId: str.id, endpoint: 'p2' };
          }
        });

        if (closestGrab) {
          this.activeGrabs.set(gesture.handId, closestGrab);
          globalBus.emit('string:grabbed', closestGrab);
        }
      }
    });

    // 3. New String Creation State Machine (only active if neither hand is grabbing an endpoint)
    if (this.activeGrabs.size > 0) {
      // Disambiguation: Hand is grabbing an endpoint, so cancel new string creation
      this.isStretching = false;
      this.releaseStartTime = 0;
      this.lastPoint1 = null;
      this.lastPoint2 = null;
      return null;
    }

    if (dualPinch.isDualPinch && dualPinch.point1 && dualPinch.point2) {
      // Motion blur flicker absorbed
      if (this.releaseStartTime > 0) {
        this.releaseStartTime = 0;
      }

      if (!this.isStretching) {
        if (nowMs - this.lastAnchorTime >= this.cooldownMs) {
          this.isStretching = true;
          this.stretchStartTime = nowMs;
        }
      }

      if (this.isStretching) {
        this.lastPoint1 = { ...dualPinch.point1 };
        this.lastPoint2 = { ...dualPinch.point2 };
      }
    } else {
      if (this.isStretching && this.lastPoint1 && this.lastPoint2) {
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

          this.isStretching = false;
          this.releaseStartTime = 0;
          this.lastPoint1 = null;
          this.lastPoint2 = null;
        }
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
    const color = STRING_PALETTE[this.strings.length % STRING_PALETTE.length];

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

    // FIFO replacement if exceeding capacity
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

  public clearAll(): void {
    const count = this.strings.length;
    this.strings = [];
    this.activeGrabs.clear();
    this.isStretching = false;
    this.releaseStartTime = 0;
    this.lastPoint1 = null;
    this.lastPoint2 = null;
    globalBus.emit('string:cleared', { count });
  }

  public removeString(id: string): void {
    const index = this.strings.findIndex((s) => s.id === id);
    if (index !== -1) {
      this.strings.splice(index, 1);
      this.strings.forEach((s, idx) => (s.index = idx));
      // Remove any active grabs on this string
      for (const [handId, grab] of this.activeGrabs.entries()) {
        if (grab.stringId === id) {
          this.activeGrabs.delete(handId);
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
