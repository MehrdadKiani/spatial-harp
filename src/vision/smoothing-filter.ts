import { Point3D } from '../types/vision';

export class LandmarkSmoother {
  private prevPoints: Map<string, Point3D> = new Map();
  private alpha: number;

  /**
   * @param alpha Smoothing factor between 0 (max smoothing / lag) and 1 (no smoothing / raw).
   * Default 0.75 gives very responsive tracking while eliminating high-frequency landmark tremor.
   */
  constructor(alpha = 0.75) {
    this.alpha = alpha;
  }

  public setAlpha(alpha: number): void {
    this.alpha = Math.max(0.01, Math.min(1.0, alpha));
  }

  public smooth(handId: number, landmarkIdx: number, raw: Point3D): Point3D {
    const key = `${handId}_${landmarkIdx}`;
    const prev = this.prevPoints.get(key);

    if (!prev) {
      const initial = { ...raw };
      this.prevPoints.set(key, initial);
      return initial;
    }

    const smoothed: Point3D = {
      x: prev.x + this.alpha * (raw.x - prev.x),
      y: prev.y + this.alpha * (raw.y - prev.y),
      z: prev.z + this.alpha * (raw.z - prev.z),
    };

    this.prevPoints.set(key, smoothed);
    return smoothed;
  }

  public reset(handId?: number): void {
    if (handId !== undefined) {
      const prefix = `${handId}_`;
      for (const key of this.prevPoints.keys()) {
        if (key.startsWith(prefix)) {
          this.prevPoints.delete(key);
        }
      }
    } else {
      this.prevPoints.clear();
    }
  }
}
