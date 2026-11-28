import { Point3D } from './vision';

export interface AnchoredString {
  id: string;
  index: number;
  point1: Point3D;       // Normalized camera space (0..1)
  point2: Point3D;       // Normalized camera space (0..1)
  worldP1: { x: number; y: number; z: number }; // Three.js world space
  worldP2: { x: number; y: number; z: number }; // Three.js world space
  length: number;        // Euclidean distance in world units
  color: number;         // Hex laser color
  createdAt: number;     // Timestamp in ms
}

export interface EndpointGrabState {
  handId: number;
  stringId: string;
  endpoint: 'p1' | 'p2';
}

export interface StringPreviewState {
  isActive: boolean;
  isCharging: boolean;
  chargeProgress: number;          // 0..1 while holding steady pinch to lock Point A
  chargePoint1?: Point3D;
  point1?: Point3D;
  point2?: Point3D;
  drawingHandId?: number;
}

export interface ChargePopEvent {
  point1: Point3D;
}

export interface SpatialStringConfig {
  maxStrings?: number;             // Default: 12
  minAnchorDistance?: number;      // Default: 0.10 (normalized camera space)
  minStretchDurationMs?: number;   // Default: 150ms
  chargeDurationMs?: number;       // Default: 450ms (hold steady pinch to pop & lock start point)
  maxChargeMoveDistance?: number;  // Default: 0.065 (max normalized drift allowed while charging)
  releaseGraceMs?: number;         // Default: 120ms (debounce tracking flicker on fast movement)
  cooldownMs?: number;             // Default: 350ms (prevent rapid accidental duplicate anchors)
  grabProximityThreshold?: number; // Default: 0.032 (tight crosshair reticle hitbox)
  grabPinchDistance?: number;      // Default: 0.040 (firm thumb-index pinch required to grab)
  grabDwellMs?: number;            // Default: 85ms (intentional hold duration on reticle)
  maxGrabHandSpeed?: number;       // Default: 0.45 (reject fast strumming hands sweeping past tips)
  palette?: number[];              // Custom numeric hex color palette for anchored strings
}
