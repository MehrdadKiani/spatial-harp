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
  private prevDistToStrings = new Map<string, number>();
  private lastPluckTimes = new Map<string, number>();
  private lastStringPluckTimes = new Map<string, number>();

  // Tracks fingers currently resting/holding on a string (hysteresis contact latch)
  // Prevents stationary fingers held on a string from auto-plucking repeatedly
  private activeTouches = new Set<string>();

  // High-sensitivity thresholds (with dead-zone margin around string tips)
  private depthTolerance = 0.55;       // Generous Z-axis depth allowance
  private touchRadius = 0.046;         // Generous proximity contact radius along the playable string body
  private releaseRadius = 0.048;       // Tight release radius so slight lift immediately re-arms
  private tipMarginRatio = 0.02;       // Outer 2% right at each string tip is an unplayable dead-zone margin
  private tipMarginRadius = 0.016;     // Exact crosshair reticle radius around each endpoint tip ignored for plucking
  private minPluckTravel = 0.0008;     // Ultra-sensitive to light finger taps while filtering dead-still noise
  private minCrossTravel = 0.0028;     // Minimum motion for centerline crossing while already inside touch zone
  private retriggerCooldownMs = 65;    // Fast finger retrigger cooldown for tremolo & rapid taps
  private stringCooldownMs = 50;       // Fast per-string cooldown allowing multi-finger harp rolls

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

          // Velocity mapping: responsive even to gentle touches (0.35 .. 1.0)
          const velocity = Math.min(1.0, Math.max(0.35, 0.35 + speed * 0.55));

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
            let rawT = 0.5;
            let projT = 0.5;
            let distToSeg = Infinity;

            if (segLenSq > 1e-6) {
              rawT = ((Bx - Cx) * segDx + (By - Cy) * segDy) / segLenSq;
              projT = Math.max(0, Math.min(1, rawT));
              const closeX = Cx + projT * segDx;
              const closeY = Cy + projT * segDy;
              distToSeg = Math.sqrt((Bx - closeX) * (Bx - closeX) + (By - closeY) * (By - closeY));
            }

            // Dead-zone margin around both string tips (P1 and P2):
            // Ignore any finger activity near the endpoints or outside the inner [tipMarginRatio .. 1 - tipMarginRatio] span
            const distToP1 = Math.sqrt((Bx - Cx) * (Bx - Cx) + (By - Cy) * (By - Cy));
            const distToP2 = Math.sqrt((Bx - Dx) * (Bx - Dx) + (By - Dy) * (By - Dy));
            if (
              distToP1 < this.tipMarginRadius ||
              distToP2 < this.tipMarginRadius ||
              rawT < this.tipMarginRatio ||
              rawT > 1.0 - this.tipMarginRatio
            ) {
              this.activeTouches.delete(pluckKey);
              return;
            }

            const prevDist = this.prevDistToStrings.get(pluckKey) ?? Infinity;
            this.prevDistToStrings.set(pluckKey, distToSeg);

            // Release contact latch if finger moved outside releaseRadius OR pulled back away from string by > 0.004
            if (this.activeTouches.has(pluckKey)) {
              if (distToSeg > this.releaseRadius || distToSeg > prevDist + 0.0035) {
                this.activeTouches.delete(pluckKey);
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
            // Always allowed when crossing the centerline with intentional motion (even during tight back-and-forth strums)
            if (travelDist >= this.minCrossTravel) {
              const denom = (Bx - Ax) * (Dy - Cy) - (By - Ay) * (Dx - Cx);

              if (Math.abs(denom) > 1e-6) {
                const u = ((Cx - Ax) * (Dy - Cy) - (Cy - Ay) * (Dx - Cx)) / denom;
                const v = ((Cx - Ax) * (By - Ay) - (Cy - Ay) * (Bx - Ax)) / denom;

                if (
                  u >= 0 &&
                  u <= 1 &&
                  v >= this.tipMarginRatio &&
                  v <= 1.0 - this.tipMarginRatio
                ) {
                  isHit = true;
                  contactRatio = v;
                }
              }
            }

            // Test 2: High-sensitivity proximity touch (when not latched by a stationary hold)
            if (
              !isHit &&
              !this.activeTouches.has(pluckKey) &&
              travelDist >= this.minPluckTravel &&
              distToSeg <= this.touchRadius
            ) {
              isHit = true;
              contactRatio = projT;
            }

            if (isHit) {
              // Latch touch state so holding the finger stationary on the string does not auto-repeat
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
    this.prevDistToStrings.clear();
    this.lastPluckTimes.clear();
    this.lastStringPluckTimes.clear();
    this.activeTouches.clear();
  }
}
