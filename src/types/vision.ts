export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type Handedness = 'Left' | 'Right';

export interface HandPose {
  id: number;
  handedness: Handedness;
  score: number;
  landmarks: Point3D[]; // Normalized 0..1 coordinates (x mirrored, y down)
  worldLandmarks?: Point3D[]; // 3D coordinates in meters centered at hand
}

export interface VisionFrameData {
  timestamp: number;
  hands: HandPose[];
  videoWidth: number;
  videoHeight: number;
}

// MediaPipe 21 Hand Landmarks connection pairs (Bone indices)
export const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [5, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [9, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [13, 17], [17, 18], [18, 19], [19, 20],
  // Palm Base
  [0, 17],
];

// Landmark key point semantic indices
export const LANDMARK_INDEX = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;
