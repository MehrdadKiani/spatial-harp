import { AnchoredString } from '../types/instruments';
import { HandPose, Point3D } from '../types/vision';
import { PluckEvent } from '../types/audio';
import { ScaleMapper } from '../audio/scale-mapper';
import { globalBus } from '../core/event-bus';

// Active plucking fingertips to track (Thumb: 4, Index: 8, Middle: 12, Ring: 16, Pinky: 20)
const PLUCKING_FINGERS = [4, 8, 12, 16, 20];

export class StringCollisionDetector {
  private scaleMapper: ScaleMapper;
  private prevFingertips = new Map<string, Point3D>();
  private lastPluckTimes = new Map<string, number>();
  private lastStringPluckTimes = new Map<string, number>();

  // Tracks fingers currently resting/holding on a string (hysteresis contact latch)
  // A finger holding on a string will not re-pluck until it leaves releaseRadius
  private activeTouches = new Set<string>();

  // Thresholds
  private depthTolerance = 0.45;       // Maximum Z-axis distance to consider collision
  private touchRadius = 0.036;         // Direct point-to-segment contact radius to engage pluck
  private releaseRadius = 0.044;       // Hysteresis release radius: finger must move outside this to re-arm
  private minPluckTravel = 0.0016;     // Minimum frame-to-frame finger motion to ignore stationary webcam jitter
  private retriggerCooldownMs = 85;    // Cooldown between repeated plucks of the same string by the same finger
  private stringCooldownMs = 75;       // Per-string cooldown to prevent multiple fingers on one swipe from flooding voices

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

          // Skip collision checks on intermediate high-Hz frames where webcam video frame has not changed
          if (travelDist < 1e-5) {
            return;
          }

          const safeDelta = Math.max(delta, 0.008);
          const speed = travelDist / safeDelta;

          // Velocity mapping: speed 0.1 -> 0.3, speed 1.5 -> 1.0
          const velocity = Math.min(1.0, Math.max(0.25, 0.25 + speed * 0.5));

          // Check collisions against every anchored string
          strings.forEach((str) => {
            const pluckKey = `${hand.id}_${fingerIdx}_${str.id}`;
            const Ax = prevPos.x, Ay = prevPos.y;
            const Bx = currentPos.x, By = currentPos.y;
            const Cx = str.point1.x, Cy = str.point1.y;
            const Dx = str.point2.x, Dy = str.point2.y;

            // Compute current perpendicular distance from fingertip B to string segment CD
            const segDx = Dx - Cx;
            const segDy = Dy - Cy;
            const segLenSq = segDx * segDx + segDy * segDy;
            let projT = 0.5;
            let distToSeg = Infinity;

            if (segLenSq > 1e-6) {
              projT = Math.max(0, Math.min(1, ((Bx - Cx) * segDx + (By - Cy) * segDy) / segLenSq));
              const closeX = Cx + projT * segDx;
              const closeY = Cy + projT * segDy;
              distToSeg = Math.sqrt((Bx - closeX) * (Bx - closeX) + (By - closeY) * (By - closeY));
            }

            // Hysteresis check: if finger is currently resting/holding on this string,
            // do not re-trigger until the finger moves outside releaseRadius
            if (this.activeTouches.has(pluckKey)) {
              if (distToSeg > this.releaseRadius) {
                this.activeTouches.delete(pluckKey);
              } else {
                return;
              }
            }

            const lastPluck = this.lastPluckTimes.get(pluckKey) || 0;
            const lastStringPluck = this.lastStringPluckTimes.get(str.id) || 0;

            if (
              nowMs - lastPluck < this.retriggerCooldownMs ||
              nowMs - lastStringPluck < this.stringCooldownMs
            ) {
              return;
            }

            // Check depth clearance
            const avgStringZ = (str.point1.z + str.point2.z) * 0.5;
            const fingerZ = (currentPos.z + prevPos.z) * 0.5;
            if (Math.abs(fingerZ - avgStringZ) > this.depthTolerance) {
              return;
            }

            let isHit = false;
            let contactRatio = projT;

            // Test 1: 2D Trajectory line segment crossing between finger (A -> B) and string (C -> D)
            if (travelDist >= this.minPluckTravel) {
              const denom = (Bx - Ax) * (Dy - Cy) - (By - Ay) * (Dx - Cx);

              if (Math.abs(denom) > 1e-6) {
                const u = ((Cx - Ax) * (Dy - Cy) - (Cy - Ay) * (Dx - Cx)) / denom;
                const v = ((Cx - Ax) * (By - Ay) - (Cy - Ay) * (Bx - Ax)) / denom;

                if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
                  isHit = true;
                  contactRatio = v;
                }
              }
            }

            // Test 2: Edge-triggered proximity touch (entering touchRadius from outside with intentional movement)
            if (!isHit && travelDist >= this.minPluckTravel && distToSeg <= this.touchRadius) {
              isHit = true;
              contactRatio = projT;
            }

            if (isHit) {
              // Latch touch state so holding the finger on the string does not auto-repeat
              this.activeTouches.add(pluckKey);
              this.lastPluckTimes.set(pluckKey, nowMs);
              this.lastStringPluckTimes.set(str.id, nowMs);

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
    this.lastStringPluckTimes.clear();
    this.activeTouches.clear();
  }
}
