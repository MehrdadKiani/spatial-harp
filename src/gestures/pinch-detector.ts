import { HandPose, LANDMARK_INDEX, Point3D } from '../types/vision';
import { DualPinchState, HandGestureState, PinchState } from '../types/gestures';

export interface PinchDetectorConfig {
  pinchThreshold?: number;     // Normalized distance below which pinch is triggered (default: 0.055)
  releaseThreshold?: number;   // Normalized distance above which pinch is released (default: 0.080)
}

export class PinchDetector {
  private pinchThreshold: number;
  private releaseThreshold: number;
  private handPinchStates: Map<number, boolean> = new Map();

  constructor(config: PinchDetectorConfig = {}) {
    this.pinchThreshold = config.pinchThreshold ?? 0.055;
    this.releaseThreshold = config.releaseThreshold ?? 0.080;
  }

  public detectHand(hand: HandPose): HandGestureState {
    const thumb = hand.landmarks[LANDMARK_INDEX.THUMB_TIP];
    const index = hand.landmarks[LANDMARK_INDEX.INDEX_TIP];

    if (!thumb || !index) {
      return {
        handId: hand.id,
        handedness: hand.handedness,
        pinch: {
          isPinching: false,
          pinchPoint: { x: 0, y: 0, z: 0 },
          distance: 1.0,
          strength: 0,
        },
        indexTip: { x: 0, y: 0, z: 0 },
        thumbTip: { x: 0, y: 0, z: 0 },
      };
    }

    // 3D Euclidean distance in normalized coordinate space
    const dx = thumb.x - index.x;
    const dy = thumb.y - index.y;
    const dz = (thumb.z - index.z) * 0.5; // depth is scaled down in normalized units
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const wasPinching = this.handPinchStates.get(hand.id) || false;
    let isPinching = wasPinching;

    // Hysteresis thresholding
    if (!wasPinching && distance < this.pinchThreshold) {
      isPinching = true;
    } else if (wasPinching && distance > this.releaseThreshold) {
      isPinching = false;
    }

    this.handPinchStates.set(hand.id, isPinching);

    // Pinch strength: 1.0 when touching (0 distance), 0.0 at releaseThreshold
    const strength = Math.max(0, Math.min(1, 1.0 - distance / this.releaseThreshold));

    const pinchPoint: Point3D = {
      x: (thumb.x + index.x) * 0.5,
      y: (thumb.y + index.y) * 0.5,
      z: (thumb.z + index.z) * 0.5,
    };

    const pinch: PinchState = {
      isPinching,
      pinchPoint,
      distance,
      strength,
    };

    return {
      handId: hand.id,
      handedness: hand.handedness,
      pinch,
      indexTip: index,
      thumbTip: thumb,
    };
  }

  public detectDualPinch(hands: HandPose[]): {
    gestureStates: HandGestureState[];
    dualPinch: DualPinchState;
  } {
    const gestureStates = hands.map((h) => this.detectHand(h));

    if (gestureStates.length < 2) {
      return {
        gestureStates,
        dualPinch: {
          isDualPinch: false,
          distance: 0,
        },
      };
    }

    const [h1, h2] = gestureStates;
    const isDualPinch = h1.pinch.isPinching && h2.pinch.isPinching;

    let distance = 0;
    if (isDualPinch) {
      const p1 = h1.pinch.pinchPoint;
      const p2 = h2.pinch.pinchPoint;
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dz = p1.z - p2.z;
      distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    return {
      gestureStates,
      dualPinch: {
        isDualPinch,
        hand1: h1,
        hand2: h2,
        point1: h1.pinch.pinchPoint,
        point2: h2.pinch.pinchPoint,
        distance,
      },
    };
  }

  public reset(): void {
    this.handPinchStates.clear();
  }
}
