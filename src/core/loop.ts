export type UpdateCallback = (delta: number, elapsed: number) => void;

export class EngineLoop {
  private isRunning = false;
  private lastTime = 0;
  private startTime = 0;
  private callbacks: Set<UpdateCallback> = new Set();
  private rafId: number | null = null;
  private frameCount = 0;
  private lastFpsUpdate = 0;
  public fps = 0;

  public add(cb: UpdateCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.lastFpsUpdate = this.startTime;
    this.frameCount = 0;

    const tick = (now: number) => {
      if (!this.isRunning) return;

      const delta = Math.min((now - this.lastTime) / 1000, 0.1); // clamp to 100ms
      const elapsed = (now - this.startTime) / 1000;
      this.lastTime = now;

      // FPS tracking
      this.frameCount++;
      if (now - this.lastFpsUpdate >= 500) {
        this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
        this.frameCount = 0;
        this.lastFpsUpdate = now;
      }

      this.callbacks.forEach((cb) => {
        try {
          cb(delta, elapsed);
        } catch (e) {
          console.error('Error in loop callback:', e);
        }
      });

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
