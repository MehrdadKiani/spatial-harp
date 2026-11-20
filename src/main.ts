import { EngineLoop } from './core/loop';
import { CameraManager } from './vision/camera-manager';
import { HandTracker } from './vision/hand-tracker';
import { SceneManager } from './render/scene-manager';
import { VideoBackground } from './render/video-background';
import { SkeletonView } from './render/skeleton-view';
import { DynamicStringView } from './render/dynamic-string-view';
import { AnchoredStringsView } from './render/anchored-strings-view';
import { PinchDetector } from './gestures/pinch-detector';
import { SpatialStringManager } from './instruments/spatial-string-manager';
import { HUD } from './ui/hud';

class App {
  private container: HTMLElement;
  private cameraManager: CameraManager;
  private videoBackground: VideoBackground;
  private handTracker: HandTracker;
  private pinchDetector: PinchDetector;
  private spatialStringManager: SpatialStringManager;
  private sceneManager: SceneManager;
  private skeletonView: SkeletonView;
  private dynamicStringView: DynamicStringView;
  private anchoredStringsView: AnchoredStringsView;
  private hud: HUD;
  private loop: EngineLoop;
  private isVisionReady = false;

  constructor() {
    this.container = document.getElementById('app') || document.body;

    // 1. Video background (mirrored video element)
    this.videoBackground = new VideoBackground(this.container);
    this.cameraManager = new CameraManager(this.videoBackground.videoElement);

    // 2. Three.js Scene, Skeleton & String visualizers
    this.sceneManager = new SceneManager(this.container);
    this.skeletonView = new SkeletonView(this.sceneManager);
    this.dynamicStringView = new DynamicStringView(this.sceneManager);
    this.anchoredStringsView = new AnchoredStringsView(this.sceneManager, 12);

    // 3. Instruments subsystem: Mid-air Spatial String Manager
    this.spatialStringManager = new SpatialStringManager(this.sceneManager, {
      maxStrings: 12,
      minAnchorDistance: 0.10,
      minStretchDurationMs: 150,
    });

    // 4. UI HUD & clear callback
    this.hud = new HUD(this.container, () => this.spatialStringManager.clearAll());

    // 5. Hand tracker, gesture detector & loop ticker
    this.handTracker = new HandTracker();
    this.pinchDetector = new PinchDetector({
      pinchThreshold: 0.055,
      releaseThreshold: 0.080,
    });
    this.loop = new EngineLoop();

    // 6. Keyboard shortcuts (C or Space to clear strings)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyC' || e.code === 'Space') {
        this.spatialStringManager.clearAll();
      }
    });
  }

  public async start(): Promise<void> {
    this.hud.setMessage('Requesting camera permission...');

    try {
      // Start camera feed
      await this.cameraManager.start({ width: 1280, height: 720 });
      this.hud.setMessage('Loading MediaPipe HandLandmarker model...');

      // Initialize hand tracking model
      await this.handTracker.init({
        wasmPath: '/wasm',
        modelAssetPath: '/models/hand_landmarker.task',
        numHands: 2,
      });

      this.isVisionReady = true;
      this.hud.setMessage('Pinch thumb & index on both hands to stretch and anchor a string.');

      // Start main tick loop
      this.loop.add((_delta, elapsed) => this.tick(elapsed));
      this.loop.start();
    } catch (err) {
      console.error('Initialization failed:', err);
      this.hud.setMessage(`Error: ${(err as Error).message}`);
    }
  }

  private tick(elapsed: number): void {
    if (!this.isVisionReady || !this.cameraManager.isReady) {
      this.sceneManager.render();
      return;
    }

    const video = this.cameraManager.video;
    const nowMs = performance.now();
    const videoAspect = this.cameraManager.aspectRatio;

    // 1. Detect hands (21 3D landmarks)
    const hands = this.handTracker.detect(video, nowMs);

    // 2. Update skeleton overlay
    this.skeletonView.update(hands, videoAspect);

    // 3. Gesture recognition: Pinch detection & dual-hand connection
    const { gestureStates, dualPinch } = this.pinchDetector.detectDualPinch(hands);

    // 4. Instruments: Spatial String Anchoring State Machine
    this.spatialStringManager.update(dualPinch, videoAspect, nowMs);
    const anchoredStrings = this.spatialStringManager.getStrings();

    // 5. Update dynamic preview string & pinch anchor reticles
    this.dynamicStringView.update(gestureStates, dualPinch, videoAspect, elapsed);

    // 6. Update anchored spatial strings (fret marks, persistent laser lines, end nodes)
    this.anchoredStringsView.update(anchoredStrings, videoAspect, elapsed);

    // 7. Update HUD diagnostics
    const handDetails = hands.map((h) => `${h.handedness}`);
    const singlePinch = gestureStates.find((g) => g.pinch.isPinching);
    const singlePinchHand = singlePinch ? singlePinch.handedness : null;

    this.hud.update(
      this.loop.fps,
      hands.length,
      handDetails,
      dualPinch.isDualPinch,
      singlePinchHand,
      anchoredStrings.length,
      this.spatialStringManager.maxCapacity
    );

    // 8. Render Three.js WebGL scene
    this.sceneManager.render();
  }
}

// Bootstrap application on window load
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.start();
});
