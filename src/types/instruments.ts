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

export interface SpatialStringConfig {
  maxStrings?: number;           // Default: 12
  minAnchorDistance?: number;    // Default: 0.10 (normalized camera space)
  minStretchDurationMs?: number; // Default: 150ms
}
