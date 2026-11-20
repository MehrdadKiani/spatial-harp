import { DualPinchState } from '../types/gestures';
import { AnchoredString, SpatialStringConfig } from '../types/instruments';
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
  }

  public update(
    dualPinch: DualPinchState,
    videoAspect: number,
    nowMs: number
  ): AnchoredString | null {
    let newlyAnchored: AnchoredString | null = null;

    if (dualPinch.isDualPinch && dualPinch.point1 && dualPinch.point2) {
      // If we were in a pending release grace window, cancel it — motion blur tracking flicker absorbed
      if (this.releaseStartTime > 0) {
        this.releaseStartTime = 0;
      }

      if (!this.isStretching) {
        // Enforce cooldown after a previous anchor to prevent rapid duplicate spawns
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
      // Dual pinch is not currently detected
      if (this.isStretching && this.lastPoint1 && this.lastPoint2) {
        if (this.releaseStartTime === 0) {
          // Start the release grace window
          this.releaseStartTime = nowMs;
        } else if (nowMs - this.releaseStartTime >= this.releaseGraceMs) {
          // Grace window expired — this is a confirmed, intentional release
          const stretchDuration = this.releaseStartTime - this.stretchStartTime;

          // Calculate normalized 3D distance between pinch points
          const dx = this.lastPoint1.x - this.lastPoint2.x;
          const dy = this.lastPoint1.y - this.lastPoint2.y;
          const dz = (this.lastPoint1.z - this.lastPoint2.z) * 0.5;
          const normDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // Validate thresholds: minimum distance & duration to prevent noise
          if (normDistance >= this.minAnchorDistance && stretchDuration >= this.minStretchDurationMs) {
            newlyAnchored = this.anchorString(this.lastPoint1, this.lastPoint2, videoAspect, nowMs);
            this.lastAnchorTime = nowMs;
          }

          // Reset stretching state after confirmed release
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
    // Re-index
    this.strings.forEach((s, idx) => (s.index = idx));

    globalBus.emit('string:anchored', anchored);
    return anchored;
  }

  public clearAll(): void {
    const count = this.strings.length;
    this.strings = [];
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
      globalBus.emit('string:removed', { id });
    }
  }

  public getStrings(): AnchoredString[] {
    return this.strings;
  }

  public get count(): number {
    return this.strings.length;
  }

  public get maxCapacity(): number {
    return this.maxStrings;
  }
}
