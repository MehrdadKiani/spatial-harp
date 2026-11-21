import * as THREE from 'three';
import { EngineLoop } from './core/loop';
import { CameraManager } from './vision/camera-manager';
import { HandTracker } from './vision/hand-tracker';
import { SceneManager } from './render/scene-manager';
import { VideoBackground } from './render/video-background';
import { SkeletonView } from './render/skeleton-view';
import { DynamicStringView } from './render/dynamic-string-view';
import { AnchoredStringsView } from './render/anchored-strings-view';
import { SparkParticlePool } from './render/spark-particle-pool';
import { PluckShockwavePool } from './render/pluck-shockwave-pool';
import { PinchDetector } from './gestures/pinch-detector';
import { SpatialStringManager } from './instruments/spatial-string-manager';
import { StringCollisionDetector } from './gestures/string-collision-detector';
import { ScaleMapper } from './audio/scale-mapper';
import { AudioEngine } from './audio/audio-engine';
import { HUD } from './ui/hud';
import { PluckEvent } from './types/audio';
import { globalBus } from './core/event-bus';

class App {
  private container: HTMLElement;
  private cameraManager: CameraManager;
  private videoBackground: VideoBackground;
  private handTracker: HandTracker;
  private pinchDetector: PinchDetector;
  private spatialStringManager: SpatialStringManager;
  private collisionDetector: StringCollisionDetector;
  private scaleMapper: ScaleMapper;
  private audioEngine: AudioEngine;
  private sceneManager: SceneManager;
  private skeletonView: SkeletonView;
  private dynamicStringView: DynamicStringView;
  private anchoredStringsView: AnchoredStringsView;
  private sparkParticlePool: SparkParticlePool;
  private pluckShockwavePool: PluckShockwavePool;
  private hud: HUD;
  private loop: EngineLoop;
  private isVisionReady = false;
  private currentElapsed = 0;

  // Reusable scratch vectors for spark burst calculations (zero-GC)
  private sparkOrigin = new THREE.Vector3();
  private sparkNormal = new THREE.Vector3();
  private sparkDir = new THREE.Vector3();

  // Short post-grab cooldown per handId so releasing a string tip doesn't accidentally pluck it
  private handGrabCooldownUntil = new Map<number, number>();

  constructor() {
    this.container = document.getElementById('app') || document.body;

    // 1. Video background (mirrored video element)
    this.videoBackground = new VideoBackground(this.container);
    this.cameraManager = new CameraManager(this.videoBackground.videoElement);

    // 2. Three.js Scene, Post-Processing Bloom & Visual Pools
    this.sceneManager = new SceneManager(this.container);
    this.skeletonView = new SkeletonView(this.sceneManager);
    this.dynamicStringView = new DynamicStringView(this.sceneManager);
    this.anchoredStringsView = new AnchoredStringsView(this.sceneManager, 12);
    this.sparkParticlePool = new SparkParticlePool(this.sceneManager.scene);
    this.pluckShockwavePool = new PluckShockwavePool(this.sceneManager.scene);

    // 3. Audio & Musical Harmony Subsystems
    this.scaleMapper = new ScaleMapper();
    this.audioEngine = new AudioEngine({
      volume: -4,
      reverbWet: 0.3,
      delayWet: 0.12,
      polyphony: 8,
      preset: 'harp',
    });
    this.collisionDetector = new StringCollisionDetector(this.scaleMapper);

    // 4. Instruments Subsystem: Mid-air Spatial String Manager
    this.spatialStringManager = new SpatialStringManager(this.sceneManager, {
      maxStrings: 12,
      minAnchorDistance: 0.10,
      minStretchDurationMs: 150,
      releaseGraceMs: 120,
      cooldownMs: 350,
      grabProximityThreshold: 0.055,
    });

    // 5. UI HUD & callbacks
    this.hud = new HUD(
      this.container,
      () => this.spatialStringManager.clearAll(),
      () => this.unlockAudio(),
      (preset) => this.audioEngine.setPreset(preset),
      (scale) => this.scaleMapper.setScaleById(scale)
    );

    // 6. Pluck feedback listener: HUD, Harmonic Wave Physics, Shockwaves & Spark VFX
    globalBus.on<PluckEvent>('string:plucked', (event) => {
      this.hud.setLastPluck(event.note, event.velocity);

      // Trigger harmonic wave ripple on the string
      this.anchoredStringsView.triggerPluck(
        event.stringId,
        event.velocity,
        event.contactRatio,
        this.currentElapsed
      );

      // Compute exact 3D strike point along the string
      const targetStr = this.spatialStringManager.getStrings().find((s) => s.id === event.stringId);
      if (targetStr) {
        const videoAspect = this.cameraManager.aspectRatio;
        const w1 = this.sceneManager.toWorldCoords(targetStr.point1.x, targetStr.point1.y, targetStr.point1.z, videoAspect);
        const w2 = this.sceneManager.toWorldCoords(targetStr.point2.x, targetStr.point2.y, targetStr.point2.z, videoAspect);

        this.sparkOrigin.lerpVectors(w1, w2, event.contactRatio);
        this.sparkDir.subVectors(w2, w1).normalize();
        this.sparkNormal.set(-this.sparkDir.y, this.sparkDir.x, 0).normalize();

        // 6a. Emit intense contact neon flash & dual expanding shockwave ripples
        this.pluckShockwavePool.emitShockwave(
          this.sparkOrigin,
          targetStr.color,
          event.velocity
        );

        // 6b. Emit radial spark particle burst, flowing light trails & floating motes at contact point
        this.sparkParticlePool.emitBurst(
          this.sparkOrigin,
          this.sparkNormal,
          targetStr.color,
          event.velocity
        );

        // 6c. Emit wave-rider particles & luminous trails propagating along the string in both directions
        this.sparkParticlePool.emitWaveTrail(
          w1,
          w2,
          this.sparkNormal,
          targetStr.color,
          event.velocity,
          event.contactRatio
        );
      }
    });

    // 7. Hand tracker, gesture detector & loop ticker
    this.handTracker = new HandTracker();
    this.pinchDetector = new PinchDetector({
      pinchThreshold: 0.055,
      releaseThreshold: 0.080,
    });
    this.loop = new EngineLoop();

    // 8. User interaction audio unlock & keyboard shortcuts
    const handleFirstInteraction = () => this.unlockAudio();
    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyC' || e.code === 'Space') {
        this.spatialStringManager.clearAll();
      }
    });
  }

  private async unlockAudio(): Promise<void> {
    const success = await this.audioEngine.unlock();
    if (success) {
      this.hud.setAudioActive(true);
    }
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
      this.loop.add((delta, elapsed) => this.tick(elapsed, delta));
      this.loop.start();
    } catch (err) {
      console.error('Initialization failed:', err);
      this.hud.setMessage(`Error: ${(err as Error).message}`);
    }
  }

  private tick(elapsed: number, delta: number): void {
    this.currentElapsed = elapsed;

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

    // 4. Instruments: Spatial String Anchoring & Endpoint Grab/Repositioning
    this.spatialStringManager.update(gestureStates, dualPinch, videoAspect, nowMs);
    const anchoredStrings = this.spatialStringManager.getStrings();
    const activeGrabs = this.spatialStringManager.getActiveGrabs();

    // 5. Collision & Plucking Engine: Detect fingertips crossing anchored strings
    const ignoreHandIds = new Set<number>();
    let grabbedStringNote: string | null = null;

    if (activeGrabs.length > 0) {
      activeGrabs.forEach((grab) => {
        ignoreHandIds.add(grab.handId);
        // Set a 250ms grace window after releasing the tip so releasing pinch doesn't pluck the string
        this.handGrabCooldownUntil.set(grab.handId, nowMs + 250);
        const grabbedStr = anchoredStrings.find((s) => s.id === grab.stringId);
        if (grabbedStr) {
          const { note } = this.scaleMapper.getNoteForString(grabbedStr, anchoredStrings);
          grabbedStringNote = note;
        }
      });
    }

    this.handGrabCooldownUntil.forEach((untilMs, handId) => {
      if (nowMs < untilMs) {
        ignoreHandIds.add(handId);
      } else {
        this.handGrabCooldownUntil.delete(handId);
      }
    });

    this.collisionDetector.update(hands, anchoredStrings, delta, nowMs, ignoreHandIds);

    // 6. Update dynamic preview string & pinch anchor reticles (only if not grabbing an endpoint)
    if (!this.spatialStringManager.isAnyEndpointGrabbed) {
      this.dynamicStringView.update(gestureStates, dualPinch, videoAspect, elapsed);
    } else {
      this.dynamicStringView.setVisible(false);
    }

    // 7. Update anchored spatial strings (fret marks, dual-wave envelopes, resonant ribbons & crosshair reticles)
    this.anchoredStringsView.update(anchoredStrings, activeGrabs, videoAspect, elapsed);

    // 8. Update GPU spark particles & shockwaves physics
    this.sparkParticlePool.update(delta);
    this.pluckShockwavePool.update(delta);

    // 9. Update HUD diagnostics
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
      this.spatialStringManager.maxCapacity,
      this.spatialStringManager.isAnyEndpointGrabbed,
      grabbedStringNote
    );

    // 10. Render Three.js WebGL scene with UnrealBloom post-processing
    this.sceneManager.render();
  }
}

// Bootstrap application on window load
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.start();
});
