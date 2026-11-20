import { AnchoredString } from '../types/instruments';
import { HandPose, Point3D } from '../types/vision';
import { PluckEvent } from '../types/audio';
import { ScaleMapper } from '../audio/scale-mapper';
import { globalBus } from '../core/event-bus';

// Active plucking fingertips to track (Thumb: 4, Index: 8, Middle: 12)
const PLUCKING_FINGERS = [4, 8, 12];

export class StringCollisionDetector {
  private scaleMapper: ScaleMapper;
  private prevFingertips = new Map<string, Point3D>();
  private lastPluckTimes = new Map<string, number>();

  // Thresholds
  private depthTolerance = 0.12;       // Maximum Z-axis distance to consider collision
  private touchRadius = 0.035;         // Direct point-to-segment proximity radius
  private retriggerCooldownMs = 120;   // Cooldown between repeated plucks of the same string by the same finger

  constructor(scaleMapper: ScaleMapper) {
    this.scaleMapper = scaleMapper;
  }

  public update(
    hands: HandPose[],
    strings: AnchoredString[],
    delta: number,
    nowMs: number,
    ignoreHandIds: Set<number> = new Set()
  ): PluckEvent[] {
    if (strings.length === 0 || hands.length === 0) {
      return [];
    }

    const pluckEvents: PluckEvent[] = [];

    hands.forEach((hand) => {
      // If hand is actively grabbing a string tip, skip plucking from that hand
      if (ignoreHandIds.has(hand.id)) {
        return;
      }

      PLUCKING_FINGERS.forEach((fingerIdx) => {
        const currentPos = hand.landmarks[fingerIdx];
        if (!currentPos) return;

        const key = `${hand.id}_${fingerIdx}`;
        const prevPos = this.prevFingertips.get(key);

        if (prevPos) {
          // Calculate finger travel velocity
          const dx = currentPos.x - prevPos.x;
          const dy = currentPos.y - prevPos.y;
          const dz = (currentPos.z - prevPos.z) * 0.5;
          const travelDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const safeDelta = Math.max(delta, 0.008);
          const speed = travelDist / safeDelta;

          // Velocity mapping: speed 0.1 -> 0.3, speed 1.5 -> 1.0
          const velocity = Math.min(1.0, Math.max(0.25, 0.25 + speed * 0.5));

          // Check collisions against every anchored string
          strings.forEach((str) => {
            const pluckKey = `${hand.id}_${fingerIdx}_${str.id}`;
            const lastPluck = this.lastPluckTimes.get(pluckKey) || 0;

            if (nowMs - lastPluck < this.retriggerCooldownMs) {
              return;
            }

            // Check depth clearance
            const avgStringZ = (str.point1.z + str.point2.z) * 0.5;
            const fingerZ = (currentPos.z + prevPos.z) * 0.5;
            if (Math.abs(fingerZ - avgStringZ) > this.depthTolerance) {
              return;
            }

            // Test 1: 2D Trajectory line segment crossing between finger (A -> B) and string (C -> D)
            const Ax = prevPos.x, Ay = prevPos.y;
            const Bx = currentPos.x, By = currentPos.y;
            const Cx = str.point1.x, Cy = str.point1.y;
            const Dx = str.point2.x, Dy = str.point2.y;

            let isHit = false;
            let contactRatio = 0.5;

            // Line-segment intersection test: (Bx - Ax, By - Ay) x (Dx - Cx, Dy - Cy)
            const denom = (Bx - Ax) * (Dy - Cy) - (By - Ay) * (Dx - Cx);

            if (Math.abs(denom) > 1e-6) {
              const u = ((Cx - Ax) * (Dy - Cy) - (Cy - Ay) * (Dx - Cx)) / denom;
              const v = ((Cx - Ax) * (By - Ay) - (Cy - Ay) * (Bx - Ax)) / denom;

              if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
                // Crossing detected!
                isHit = true;
                contactRatio = v;
              }
            }

            // Test 2: Point-to-segment proximity (for slow movements)
            if (!isHit) {
              const segDx = Dx - Cx;
              const segDy = Dy - Cy;
              const segLenSq = segDx * segDx + segDy * segDy;

              if (segLenSq > 1e-6) {
                const t = Math.max(0, Math.min(1, ((Bx - Cx) * segDx + (By - Cy) * segDy) / segLenSq));
                const closeX = Cx + t * segDx;
                const closeY = Cy + t * segDy;
                const distToSeg = Math.sqrt((Bx - closeX) * (Bx - closeX) + (By - closeY) * (By - closeY));

                if (distToSeg <= this.touchRadius) {
                  isHit = true;
                  contactRatio = t;
                }
              }
            }

            if (isHit) {
              this.lastPluckTimes.set(pluckKey, nowMs);

              const { note, frequency } = this.scaleMapper.getNoteForString(str, strings);

              const event: PluckEvent = {
                stringId: str.id,
                stringIndex: str.index,
                note,
                frequency,
                velocity,
                contactRatio,
                handId: hand.id,
                fingerIndex: fingerIdx,
                timestamp: nowMs,
              };

              pluckEvents.push(event);
              globalBus.emit('string:plucked', event);
            }
          });
        }

        // Cache current position for next frame
        this.prevFingertips.set(key, { ...currentPos });
      });
    });

    return pluckEvents;
  }

  public reset(): void {
    this.prevFingertips.clear();
    this.lastPluckTimes.clear();
  }
}
