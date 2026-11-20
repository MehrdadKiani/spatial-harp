import { Handedness, Point3D } from './vision';

export interface PinchState {
  isPinching: boolean;
  pinchPoint: Point3D; // Midpoint between thumb tip and index tip in normalized space
  distance: number;   // 3D Euclidean distance between thumb and index
  strength: number;   // 0 (open) to 1 (fully pinched)
}

export interface HandGestureState {
  handId: number;
  handedness: Handedness;
  pinch: PinchState;
  indexTip: Point3D;
  thumbTip: Point3D;
}

export interface DualPinchState {
  isDualPinch: boolean;
  hand1?: HandGestureState;
  hand2?: HandGestureState;
  point1?: Point3D;
  point2?: Point3D;
  distance: number;
}
