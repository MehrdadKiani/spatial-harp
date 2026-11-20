export interface StringVibrationState {
  stringId: string;
  initialAmplitude: number;
  amplitude?: number;
  frequency: number;       // Visual wave oscillation speed in rad/s (~28)
  damping: number;         // Decay factor gamma (~3.6)
  startTime: number;       // In seconds (elapsed)
  contactRatio: number;    // 0..1 pluck position along string
  active: boolean;
}

export interface SparkParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  life: number;
  maxLife: number;
  active: boolean;
}
