import { AnchoredString } from '../types/instruments';
import { HandPose, Point3D } from '../types/vision';
import { PluckEvent } from '../types/audio';
import { ScaleMapper } from '../audio/scale-mapper';
import { globalBus } from '../core/event-bus';
import { PluckingConfigGroup } from '../core/config';

// Default active plucking fingertips to track (Thumb: 4, Index: 8, Middle: 12, Ring: 16, Pinky: 20)
const DEFAULT_PLUCKING_FINGERS = [4, 8, 12, 16, 20];

export class StringCollisionDetector {
  private scaleMapper: ScaleMapper;
  private prevFingertips = new Map<string, Point3D>();
  private prevDistToStrings = new Map<string, number>();
  private lastPluckTimes = new Map<string, number>();
  private lastStringPluckTimes = new Map<string, number>();

  // Tracks fingers currently resting/holding on a string (hysteresis contact latch)
  // Prevents stationary fingers held on a string from auto-plucking repeatedly
  private activeTouches = new Set<string>();

  // Natural acoustic pluck thresholds with hysteresis latch
  private pluckingFingers: number[] = DEFAULT_PLUCKING_FINGERS;
  private depthTolerance = 0.55;       // Generous Z-axis depth allowance
  private touchRadius = 0.036;         // Contact radius to engage a pluck when approaching the string
  private releaseRadius = 0.054;       // Wide hysteresis release radius so held fingers never jitter-unlatch
  private tipMarginRatio = 0.02;       // Outer 2% right at each string tip is an unplayable dead-zone margin
  private tipMarginRadius = 0.016;     // Exact crosshair reticle radius around each endpoint tip ignored for plucking
  private minPluckTravel = 0.0025;     // Minimum intentional finger motion to filter multi-finger stationary tremor
  private retriggerCooldownMs = 120;   // Per-finger cooldown
  private stringCooldownMs = 110;      // Per-string cooldown so placing multiple fingers down triggers one clean pluck

  constructor(scaleMapper: ScaleMapper) {
    this.scaleMapper = scaleMapper;
  }

  public configure(cfg: Partial<PluckingConfigGroup>): void {
    if (cfg.pluckingFingers && cfg.pluckingFingers.length > 0) this.pluckingFingers = cfg.pluckingFingers;
    if (cfg.depthTolerance !== undefined) this.depthTolerance = cfg.depthTolerance;
    if (cfg.touchRadius !== undefined) this.touchRadius = cfg.touchRadius;
    if (cfg.releaseRadius !== undefined) this.releaseRadius = cfg.releaseRadius;
    if (cfg.tipMarginRatio !== undefined) this.tipMarginRatio = cfg.tipMarginRatio;
    if (cfg.tipMarginRadius !== undefined) this.tipMarginRadius = cfg.tipMarginRadius;
    if (cfg.minPluckTravel !== undefined) this.minPluckTravel = cfg.minPluckTravel;
    if (cfg.retriggerCooldownMs !== undefined) this.retriggerCooldownMs = cfg.retriggerCooldownMs;
    if (cfg.stringCooldownMs !== undefined) this.stringCooldownMs = cfg.stringCooldownMs;
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

      this.pluckingFingers.forEach((fingerIdx) => {
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

            // Dead-zone margin around both string tips (P1 and P2)
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

            // Strict hysteresis latch: if this finger is already touching/holding the string,
            // it MUST move completely outside releaseRadius (0.054) before it can pluck again.
            if (this.activeTouches.has(pluckKey)) {
              if (distToSeg > this.releaseRadius) {
                this.activeTouches.delete(pluckKey);
              } else {
                return;
              }
            }

            // Also latch silently if a stationary finger is already resting inside touchRadius without intentional motion
            if (distToSeg <= this.touchRadius && travelDist < this.minPluckTravel) {
              this.activeTouches.add(pluckKey);
              return;
            }

            const lastPluck = this.lastPluckTimes.get(pluckKey) || 0;
            const lastStringPluck = this.lastStringPluckTimes.get(str.id) || 0;

            if (
              nowMs - lastPluck < this.retriggerCooldownMs ||
              nowMs - lastStringPluck < this.stringCooldownMs
            ) {
              // If another finger on the hand just plucked this string, latch this finger too
              // so placing multiple fingers on a string doesn't stagger-fire each finger
              if (distToSeg <= this.touchRadius) {
                this.activeTouches.add(pluckKey);
              }
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

            // Test 2: Approaching proximity touch (finger moving inward into touchRadius from outside)
            const isApproaching = distToSeg < prevDist - 0.001;
            if (
              !isHit &&
              isApproaching &&
              travelDist >= this.minPluckTravel &&
              distToSeg <= this.touchRadius
            ) {
              isHit = true;
              contactRatio = projT;
            }

            if (isHit) {
              // Latch touch state so holding one or multiple fingers on the string never auto-repeats
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
