import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandPose, Point3D } from '../types/vision';
import { LandmarkSmoother } from './smoothing-filter';

export interface HandTrackerConfig {
  numHands?: number;
  smoothingAlpha?: number;
  minHandDetectionConfidence?: number;
  minHandPresenceConfidence?: number;
  minTrackingConfidence?: number;
  wasmPath?: string;
  modelAssetPath?: string;
}

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private smoother: LandmarkSmoother = new LandmarkSmoother(0.75);
  private isInitializing = false;
  private lastVideoTime = -1;
  private lastPoses: HandPose[] = [];

  public async init(config: HandTrackerConfig = {}): Promise<void> {
    if (this.landmarker || this.isInitializing) return;
    this.isInitializing = true;

    if (config.smoothingAlpha !== undefined) {
      this.smoother.setAlpha(config.smoothingAlpha);
    }

    const wasmPath = config.wasmPath || '/wasm';
    const modelAssetPath = config.modelAssetPath || '/models/hand_landmarker.task';
    const minHandDetectionConfidence = config.minHandDetectionConfidence ?? 0.55;
    const minHandPresenceConfidence = config.minHandPresenceConfidence ?? 0.55;
    const minTrackingConfidence = config.minTrackingConfidence ?? 0.55;

    try {
      // Initialize FilesetResolver using local wasm files
      const vision = await FilesetResolver.forVisionTasks(wasmPath);

      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: config.numHands || 2,
        minHandDetectionConfidence,
        minHandPresenceConfidence,
        minTrackingConfidence,
      });

      console.log('MediaPipe HandLandmarker initialized successfully (GPU accelerated).');
    } catch (err) {
      console.warn('GPU delegate failed or unavailable, falling back to CPU delegate:', err);
      try {
        const vision = await FilesetResolver.forVisionTasks(wasmPath);

        this.landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: config.numHands || 2,
          minHandDetectionConfidence,
          minHandPresenceConfidence,
          minTrackingConfidence,
        });
        console.log('MediaPipe HandLandmarker initialized on CPU.');
      } catch (cpuErr) {
        console.error('Failed to initialize HandLandmarker:', cpuErr);
        throw cpuErr;
      }
    } finally {
      this.isInitializing = false;
    }
  }

  public get isReady(): boolean {
    return this.landmarker !== null;
  }

  public detect(video: HTMLVideoElement, timestamp: number): HandPose[] {
    if (!this.landmarker || video.readyState < 2) {
      return [];
    }

    // MediaPipe requires monotonically increasing timestamps; return cached poses between 30fps video frames on high-Hz monitors
    if (video.currentTime === this.lastVideoTime) {
      return this.lastPoses;
    }
    this.lastVideoTime = video.currentTime;

    const result = this.landmarker.detectForVideo(video, timestamp);
    if (!result.landmarks || result.landmarks.length === 0) {
      this.smoother.reset();
      this.lastPoses = [];
      return [];
    }

    const poses: HandPose[] = [];

    for (let h = 0; h < result.landmarks.length; h++) {
      const rawLandmarks = result.landmarks[h];
      const handednessStr = result.handednesses[h]?.[0]?.categoryName || 'Right';
      const score = result.handednesses[h]?.[0]?.score || 1.0;

      // Note: Video is mirrored horizontally for intuitive user interaction
      // In mirrored view: (1 - x) maps camera coordinates to screen reflection
      const smoothedLandmarks: Point3D[] = rawLandmarks.map((pt, idx) => {
        const mirrored: Point3D = {
          x: 1.0 - pt.x,
          y: pt.y,
          z: pt.z,
        };
        return this.smoother.smooth(h, idx, mirrored);
      });

      poses.push({
        id: h,
        handedness: handednessStr === 'Left' ? 'Left' : 'Right',
        score,
        landmarks: smoothedLandmarks,
        worldLandmarks: result.worldLandmarks?.[h],
      });
    }

    this.lastPoses = poses;
    return poses;
  }

  public setSmoothing(alpha: number): void {
    this.smoother.setAlpha(alpha);
  }
}
