export interface StringVibrationState {
  stringId: string;
  initialAmplitude: number;
  amplitude?: number;
  frequency: number;       // Fundamental visual oscillation speed in rad/s (~34)
  waveSpeed: number;       // Bi-directional traveling wave speed along normalized string (u/sec)
  damping: number;         // Exponential decay factor gamma (~2.3 for ~1.8s smooth decay)
  startTime: number;       // In seconds (elapsed)
  contactRatio: number;    // 0..1 exact pluck position along string
  velocity: number;        // 0..1 strike intensity
  active: boolean;
}

export interface SparkParticle {
  x: number;
  y: number;
  z: number;
  prevX: number;
  prevY: number;
  prevZ: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  life: number;
  maxLife: number;
  trailLength: number;
  phase: number;
  type: 'spark' | 'mote' | 'trail';
  active: boolean;
}

export interface ShockwaveState {
  id: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  maxRadius: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  elapsed: number;
  duration: number;
  active: boolean;
}
