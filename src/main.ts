import * as THREE from 'three';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { EngineLoop } from './core/loop';
import {
  AppConfig,
  DEFAULT_CONFIG,
  clearPresetFxOverride,
  getPresetFxOverride,
  loadAppConfig,
  parseHexPalette,
  savePresetFxOverride,
  saveUserOverride,
} from './core/config';
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
import { NavBar } from './ui/nav-bar';
import { SplashScreen } from './ui/splash-screen';
import { SoundStudioPanel } from './ui/sound-studio-panel';
import { SettingsPanel } from './ui/settings-panel';
import { TutorialModal } from './ui/tutorial-modal';
import { HandPrompt } from './ui/hand-prompt';
import { PitchMode, PluckEvent } from './types/audio';
import { ChargePopEvent, HandInteractionMode } from './types/instruments';
import { globalBus } from './core/event-bus';

// Initialize Vercel Web Analytics and Speed Insights
inject();
injectSpeedInsights();

class App {
  private container: HTMLElement;
  private config: AppConfig = DEFAULT_CONFIG;
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
  private navBar: NavBar;
  private soundStudioPanel: SoundStudioPanel;
  private settingsPanel: SettingsPanel;
  private tutorialModal: TutorialModal;
  private splashScreen: SplashScreen;
  private handPrompt: HandPrompt;
  private hud: HUD;
  private loop: EngineLoop;
  private isVisionReady = false;
  private isLoopInitialized = false;
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

    // 2. Three.js Scene & Visual Pools
    this.sceneManager = new SceneManager(this.container);
    this.skeletonView = new SkeletonView(this.sceneManager);
    this.dynamicStringView = new DynamicStringView(this.sceneManager);
    this.anchoredStringsView = new AnchoredStringsView(
      this.sceneManager,
      this.config.strings.maxStrings
    );
    this.sparkParticlePool = new SparkParticlePool(this.sceneManager.scene);
    this.pluckShockwavePool = new PluckShockwavePool(this.sceneManager.scene);

    // 3. Audio & Musical Harmony Subsystems
    this.scaleMapper = new ScaleMapper(this.config.audio.defaultScale, this.config.audio.pitchMode);
    this.audioEngine = new AudioEngine({
      volume: this.config.audio.volumeDb,
      reverbWet: this.config.audio.reverbWet,
      delayWet: this.config.audio.delayWet,
      polyphony: this.config.audio.polyphony,
      preset: this.config.audio.defaultPreset,
    });
    this.collisionDetector = new StringCollisionDetector(this.scaleMapper);

    // 4. Instruments Subsystem: Mid-air Spatial String Manager
    this.spatialStringManager = new SpatialStringManager(this.sceneManager, {
      handMode: this.config.strings.handMode,
      maxStrings: this.config.strings.maxStrings,
      minAnchorDistance: this.config.strings.minAnchorDistance,
      minStretchDurationMs: this.config.strings.minStretchDurationMs,
      chargeDurationMs: this.config.strings.chargeDurationMs,
      maxChargeMoveDistance: this.config.strings.maxChargeMoveDistance,
      releaseGraceMs: this.config.strings.releaseGraceMs,
      cooldownMs: this.config.strings.cooldownMs,
      grabProximityThreshold: this.config.strings.grabProximityThreshold,
      grabPinchDistance: this.config.strings.grabPinchDistance,
      grabDwellMs: this.config.strings.grabDwellMs,
      maxGrabHandSpeed: this.config.strings.maxGrabHandSpeed,
      palette: parseHexPalette(this.config.strings.palette),
    });

    // 5. UI NavBar, SoundStudioPanel, SettingsPanel, HUD & Splash Screen
    this.soundStudioPanel = new SoundStudioPanel(this.container, {
      onPresetChange: (preset) => {
        this.audioEngine.setPreset(preset);
        const savedFx = getPresetFxOverride(preset);
        if (savedFx) {
          this.audioEngine.setFxParams(savedFx);
        }
        this.soundStudioPanel.setFxParams(this.audioEngine.getFxParams());
        saveUserOverride({ defaultPreset: preset });
        this.hud.updateAudioPreset(preset);
      },
      onScaleChange: (scale) => {
        this.scaleMapper.setScaleById(scale);
        saveUserOverride({ defaultScale: scale });
      },
      onFxChange: (patch) => {
        this.audioEngine.setFxParams(patch);
        savePresetFxOverride(this.audioEngine.currentPreset, this.audioEngine.getFxParams());
      },
      onFxReset: () => {
        clearPresetFxOverride(this.audioEngine.currentPreset);
        const defaults = this.audioEngine.resetPresetFx();
        this.soundStudioPanel.setFxParams(defaults);
      },
      onClose: () => {
        this.navBar.setActiveTab('instrument');
      },
    });

    this.settingsPanel = new SettingsPanel(this.container, {
      initialHandMode: this.config.strings.handMode,
      initialPitchMode: this.config.audio.pitchMode,
      initialShowLiveHints: this.config.ui.showLiveHints,
      onHandModeChange: (mode) => {
        this.setHandMode(mode, true);
      },
      onPitchModeChange: (pitchMode) => {
        this.setPitchMode(pitchMode, true);
      },
      onShowLiveHintsChange: (enabled) => {
        this.config.ui.showLiveHints = enabled;
        this.handPrompt.configure(enabled);
        saveUserOverride({ showLiveHints: enabled });
      },
      onClose: () => {
        this.navBar.setActiveTab('instrument');
      },
    });

    this.tutorialModal = new TutorialModal(this.container, () => {
      this.navBar.setActiveTab('instrument');
    });
    this.handPrompt = new HandPrompt(this.container, {
      initialHandMode: this.config.strings.handMode,
      onAutoSwitchToOneHand: () => {
        this.setHandMode('one-hand', true);
      },
    });

    this.navBar = new NavBar(this.container, {
      onTabChange: (tabId) => {
        if (tabId === 'studio') {
          this.settingsPanel.close();
          this.soundStudioPanel.open();
        } else if (tabId === 'settings') {
          this.soundStudioPanel.close();
          this.settingsPanel.open();
        } else {
          this.soundStudioPanel.close();
          this.settingsPanel.close();
        }
      },
      onToggleDiagnostics: () => {
        this.hud.toggleCard();
      },
      onToggleLock: () => {
        this.toggleHarpLock();
      },
      onClearStrings: () => {
        this.spatialStringManager.clearAll();
      },
    });

    this.hud = new HUD(
      this.container,
      () => this.unlockAudio(),
      (expanded) => {
        this.navBar.setDiagnosticsActive(expanded);
      }
    );

    // Initial Splash Screen: clicking START explicitly requests camera, unlocks Web Audio & opens tutorial
    this.splashScreen = new SplashScreen(this.container, {
      initialHandMode: this.config.strings.handMode,
      onHandModeChange: (mode) => {
        this.setHandMode(mode, true);
      },
      onStart: async () => {
        await this.startExperience();
      },
    });

    // Persistent sticky bottom-right version badge
    const versionBadge = document.createElement('div');
    versionBadge.id = 'app-version-badge';
    versionBadge.textContent = `v${__APP_VERSION__}`;
    Object.assign(versionBadge.style, {
      position: 'fixed',
      bottom: 'max(10px, env(safe-area-inset-bottom, 10px))',
      right: 'max(14px, env(safe-area-inset-right, 14px))',
      zIndex: '20',
      fontFamily: 'var(--font-primary)',
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.8px',
      color: 'rgba(0, 240, 255, 0.70)',
      background: 'rgba(8, 12, 22, 0.65)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid rgba(0, 240, 255, 0.22)',
      borderRadius: '6px',
      padding: '3px 8px',
      pointerEvents: 'none',
      userSelect: 'none',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
    });
    this.container.appendChild(versionBadge);

    // 6. Pluck feedback listener: HUD, Harmonic Wave Physics, Shockwaves & Spark VFX
    globalBus.on<PluckEvent>('string:plucked', (event) => {
      this.handPrompt.markPlucked();
      this.hud.setLastPluck(event.note, event.velocity);

      // Trigger multi-crest sinusoidal rainbow wave on the string
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

        // 6a. Emit radial starburst contact rays
        this.pluckShockwavePool.emitShockwave(
          this.sparkOrigin,
          targetStr.color,
          event.velocity
        );

        // 6b. Emit radial spark particle burst at contact point
        this.sparkParticlePool.emitBurst(
          this.sparkOrigin,
          this.sparkNormal,
          targetStr.color,
          event.velocity
        );

        // 6c. Emit fine spectrum glitter dust along the rainbow wave crests
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

    // 6b. Hold-to-charge pop burst listener (shockwave + sparks + tactile audio pop)
    globalBus.on<ChargePopEvent>('string:charge_pop', (event) => {
      const videoAspect = this.cameraManager.aspectRatio;
      const emitPopAt = (pt: { x: number; y: number; z: number }) => {
        const worldPos = this.sceneManager.toWorldCoords(pt.x, pt.y, pt.z, videoAspect);
        this.sparkOrigin.copy(worldPos);
        this.sparkNormal.set(0, 1, 0);
        this.pluckShockwavePool.emitShockwave(this.sparkOrigin, 0x38ef7d, 0.9);
        this.sparkParticlePool.emitBurst(this.sparkOrigin, this.sparkNormal, 0x00f0ff, 0.85);
      };

      emitPopAt(event.point1);
      if (event.point2) {
        emitPopAt(event.point2);
      }
      this.audioEngine.playAnchorPop();
    });

    // 7. Hand tracker, gesture detector & loop ticker
    this.handTracker = new HandTracker();
    this.pinchDetector = new PinchDetector({
      pinchThreshold: this.config.pinch.pinchThreshold,
      releaseThreshold: this.config.pinch.releaseThreshold,
    });
    this.loop = new EngineLoop();

    // 8. User interaction audio unlock & keyboard shortcuts
    const handleFirstInteraction = () => this.unlockAudio();
    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyC' || e.code === 'Space') {
        this.spatialStringManager.clearAll();
      } else if (e.code === 'KeyL') {
        this.toggleHarpLock();
      }
    });
  }

  private applyConfig(cfg: AppConfig): void {
    this.config = cfg;

    // 1. Pinch gesture thresholds
    this.pinchDetector.configure(cfg.pinch);

    // 2. Spatial strings & 3-layer anti-snag tip grabbing
    this.spatialStringManager.configure({
      ...cfg.strings,
      palette: parseHexPalette(cfg.strings.palette),
    });

    // 3. Plucking sensitivity & tip dead-zone margins
    this.collisionDetector.configure(cfg.plucking);

    // 4. Audio engine & scale mapper
    this.scaleMapper.configure({
      defaultScale: cfg.audio.defaultScale,
      pitchMode: cfg.audio.pitchMode,
      fretZones: cfg.audio.fretZones,
      minNormLengthForPitch: cfg.audio.minNormLengthForPitch,
      maxNormLengthForPitch: cfg.audio.maxNormLengthForPitch,
    });
    this.audioEngine.configure({
      volumeDb: cfg.audio.volumeDb,
      defaultPreset: cfg.audio.defaultPreset,
    });
    const savedPresetFx = getPresetFxOverride(cfg.audio.defaultPreset);
    if (savedPresetFx) {
      this.audioEngine.setFxParams(savedPresetFx);
    }

    // 5. Visuals, hand skeleton sizing, laser beam widths, ruler transparency, rainbow waves & particles
    this.skeletonView.configure(cfg.visuals);
    this.anchoredStringsView.configure(cfg.visuals);
    this.dynamicStringView.configure(cfg.visuals);
    this.pluckShockwavePool.configure(cfg.visuals);
    this.sparkParticlePool.configure(cfg.visuals);

    // 6. Sync Sound Studio dropdowns, FX sliders, Settings, Splash & UI hints with loaded config
    this.soundStudioPanel.setSelectedPreset(cfg.audio.defaultPreset);
    this.soundStudioPanel.setSelectedScale(cfg.audio.defaultScale);
    this.soundStudioPanel.setFxParams(this.audioEngine.getFxParams());
    this.settingsPanel.setHandMode(cfg.strings.handMode);
    this.settingsPanel.setPitchMode(cfg.audio.pitchMode);
    this.settingsPanel.setShowLiveHints(cfg.ui.showLiveHints);
    this.splashScreen.setHandMode(cfg.strings.handMode);
    this.handPrompt.setHandMode(cfg.strings.handMode);
    this.handPrompt.configure(cfg.ui.showLiveHints);
  }

  private setPitchMode(mode: PitchMode, persist = true): void {
    this.config.audio.pitchMode = mode;
    this.scaleMapper.setPitchMode(mode);
    this.settingsPanel.setPitchMode(mode);
    if (persist) {
      saveUserOverride({ pitchMode: mode });
    }
  }

  private setHandMode(mode: HandInteractionMode, persist = true): void {
    this.config.strings.handMode = mode;
    this.spatialStringManager.setHandMode(mode);
    this.handPrompt.setHandMode(mode);
    this.settingsPanel.setHandMode(mode);
    this.splashScreen.setHandMode(mode);

    // Default to Fretted Pitch Mode in One-Hand Mode and Classic Length Mode in Two-Hand Mode
    const defaultPitchForHandMode: PitchMode = mode === 'one-hand' ? 'fretted' : 'length';
    this.setPitchMode(defaultPitchForHandMode, persist);

    if (persist) {
      saveUserOverride({ handMode: mode });
    }

    if (this.isVisionReady) {
      this.hud.setMessage(
        this.spatialStringManager.getIsLocked()
          ? 'Harp Locked (Play Mode) — strum freely! Press [L] or click Lock to edit.'
          : mode === 'one-hand'
            ? 'One-Hand Mode: Hold pinch steady to pop-lock Point A, drag & release.'
            : 'Two-Hand Mode: Hold dual pinch steady to pop-lock, stretch & release.'
      );
    }
  }

  private toggleHarpLock(): void {
    const nextLocked = !this.spatialStringManager.getIsLocked();
    this.spatialStringManager.setLocked(nextLocked);
    this.navBar.setLocked(nextLocked);
    if (this.isVisionReady) {
      this.hud.setMessage(
        nextLocked
          ? 'Harp Locked (Play Mode) — strum freely! Press [L] or click Lock to edit.'
          : this.config.strings.handMode === 'one-hand'
            ? 'Harp Unlocked — hold pinch steady to draw strings.'
            : 'Harp Unlocked — hold dual pinch steady to stretch strings.'
      );
    }
  }

  private async unlockAudio(): Promise<void> {
    const success = await this.audioEngine.unlock();
    if (success) {
      this.hud.setAudioActive(true);
    }
  }

  public async start(): Promise<void> {
    this.splashScreen.setProgress(0.15, 'Loading configuration (/config.json)...');
    this.hud.setMessage('Loading configuration (/config.json)...');

    try {
      // 1. Load external /config.json + localStorage overrides
      const loadedConfig = await loadAppConfig('/config.json');
      this.applyConfig(loadedConfig);
      this.splashScreen.setProgress(0.40, 'Configuration loaded.');

      // 2. Preload MediaPipe HandLandmarker assets (WASM & weights) in background (NO camera prompt)
      this.splashScreen.setProgress(0.65, 'Preloading MediaPipe HandLandmarker...');
      this.hud.setMessage('Preloading MediaPipe HandLandmarker model...');
      await this.handTracker.init({
        wasmPath: this.config.vision.wasmPath,
        modelAssetPath: this.config.vision.modelAssetPath,
        numHands: this.config.vision.numHands,
        smoothingAlpha: this.config.vision.smoothingAlpha,
        minHandDetectionConfidence: this.config.vision.minHandDetectionConfidence,
        minHandPresenceConfidence: this.config.vision.minHandPresenceConfidence,
        minTrackingConfidence: this.config.vision.minTrackingConfidence,
      });

      // 3. Mark preloading complete and enable Start Experience button (camera requested on click)
      this.splashScreen.setProgress(1.0, 'Ready! Click START EXPERIENCE to begin.');
      this.hud.setMessage('Ready. Click START EXPERIENCE on the splash screen to begin.');
    } catch (err) {
      console.error('Initialization failed:', err);
      const errMsg = (err as Error).message;
      this.splashScreen.setError(`Error loading resources: ${errMsg}`, () => {
        this.start();
      });
      this.hud.setMessage(`Error: ${errMsg}`);
    }
  }

  private async startExperience(): Promise<void> {
    this.splashScreen.setLoading('Requesting camera stream & unlocking audio...');
    this.hud.setMessage('Requesting camera permission...');

    try {
      // 1. Unlock Web Audio Context upon intentional user gesture
      await this.unlockAudio();

      // 2. Request and start camera feed now (upon explicit user click)
      await this.cameraManager.start({
        width: this.config.vision.cameraWidth,
        height: this.config.vision.cameraHeight,
      });

      // 3. Ensure HandTracker is initialized
      if (!this.handTracker.isReady) {
        this.splashScreen.setLoading('Finalizing vision model...');
        await this.handTracker.init({
          wasmPath: this.config.vision.wasmPath,
          modelAssetPath: this.config.vision.modelAssetPath,
          numHands: this.config.vision.numHands,
          smoothingAlpha: this.config.vision.smoothingAlpha,
          minHandDetectionConfidence: this.config.vision.minHandDetectionConfidence,
          minHandPresenceConfidence: this.config.vision.minHandPresenceConfidence,
          minTrackingConfidence: this.config.vision.minTrackingConfidence,
        });
      }

      this.isVisionReady = true;
      this.hud.setMessage(
        this.config.strings.handMode === 'one-hand'
          ? 'One-Hand Mode: Pinch & drag in mid-air to draw and lock a string.'
          : 'Two-Hand Mode: Pinch thumb & index on both hands to stretch and anchor a string.'
      );

      // 4. Start main RAF tick loop
      if (!this.isLoopInitialized) {
        this.loop.add((delta, elapsed) => this.tick(elapsed, delta));
        this.isLoopInitialized = true;
      }
      this.loop.start();
      this.handPrompt.activate();

      // 5. Open the 4-step tutorial popup if enabled in config
      if (this.config.ui.showTutorialOnStart) {
        this.tutorialModal.open();
      }
    } catch (err) {
      console.error('Failed to start experience:', err);
      const errMsg = (err as Error).message;
      this.splashScreen.setError(
        `Camera permission error: ${errMsg}. Please grant camera access to use hand tracking.`,
        () => this.startExperience()
      );
      this.hud.setMessage(`Camera error: ${errMsg}`);
      throw err; // Re-throw to prevent splash screen dismissal
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
    const previewState = this.spatialStringManager.getPreviewState(dualPinch);

    // Update live step-by-step hand coaching pill (zero-GC)
    this.handPrompt.update(hands.length, previewState.isActive, anchoredStrings.length, nowMs);

    // 5. Collision & Plucking Engine: Detect fingertips crossing anchored strings
    const ignoreHandIds = new Set<number>();
    let grabbedStringNote: string | null = null;
    const postGrabCooldown = this.config.strings.postGrabReleaseCooldownMs;

    const drawingHandId = this.spatialStringManager.getDrawingHandId();
    if (drawingHandId !== null) {
      ignoreHandIds.add(drawingHandId);
      this.handGrabCooldownUntil.set(drawingHandId, nowMs + postGrabCooldown);
    }

    if (activeGrabs.length > 0) {
      activeGrabs.forEach((grab) => {
        ignoreHandIds.add(grab.handId);
        this.handGrabCooldownUntil.set(grab.handId, nowMs + postGrabCooldown);
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
      this.dynamicStringView.update(gestureStates, previewState, videoAspect, elapsed);
    } else {
      this.dynamicStringView.setVisible(false);
    }

    // 7. Update anchored spatial strings (straight baseline, sinusoidal rainbow wave, echo contours & crosshairs)
    this.anchoredStringsView.update(anchoredStrings, activeGrabs, videoAspect, elapsed);

    // 8. Update GPU spark particles & starburst rays physics
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

    // 10. Render Three.js WebGL scene
    this.sceneManager.render();
  }

  public getNavBar(): NavBar {
    return this.navBar;
  }

  public getSplashScreen(): SplashScreen {
    return this.splashScreen;
  }

  public getSoundStudioPanel(): SoundStudioPanel {
    return this.soundStudioPanel;
  }
}

// Bootstrap application on window load
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.start();
});
