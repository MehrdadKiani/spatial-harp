import * as THREE from 'three';
import './ui/styles.css';
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
import {
  PerformanceProfile,
  resolvePerformanceProfile,
} from './core/performance';
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
import { AboutModal } from './ui/about-modal';
import { HandPrompt } from './ui/hand-prompt';
import { PitchMode, PluckEvent } from './types/audio';
import { ChargePopEvent } from './types/instruments';
import { globalBus } from './core/event-bus';

// Initialize Vercel Web Analytics and Speed Insights
inject();
injectSpeedInsights();

class App {
  private container: HTMLElement;
  private config: AppConfig = DEFAULT_CONFIG;
  private perfProfile: PerformanceProfile;
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
  private aboutModal: AboutModal;
  private splashScreen: SplashScreen;
  private handPrompt: HandPrompt;
  private hud: HUD;
  private loop: EngineLoop;
  private isVisionReady = false;
  private isLoopInitialized = false;
  private isSpawningStarter = false;
  private currentElapsed = 0;

  // Reusable scratch vectors for spark burst calculations (zero-GC)
  private sparkOrigin = new THREE.Vector3();
  private sparkNormal = new THREE.Vector3();
  private sparkDir = new THREE.Vector3();
  private sparkW1 = new THREE.Vector3();
  private sparkW2 = new THREE.Vector3();

  // Short post-grab cooldown per handId so releasing a string tip doesn't accidentally pluck it
  private handGrabCooldownUntil = new Map<number, number>();

  constructor() {
    this.container = document.getElementById('app') || document.body;

    // 0. Resolve device performance profile automatically before instantiating WebGL, pools, and audio
    this.perfProfile = resolvePerformanceProfile('auto');
    document.body.classList.toggle('perf-mobile', this.perfProfile.disableBackdropBlur);

    // 1. Video background (mirrored video element)
    this.videoBackground = new VideoBackground(this.container);
    this.cameraManager = new CameraManager(this.videoBackground.videoElement);

    // 2. Three.js Scene & Visual Pools
    this.sceneManager = new SceneManager(this.container, {
      maxPixelRatio: this.perfProfile.maxPixelRatio,
      antialias: this.perfProfile.antialias,
    });
    this.skeletonView = new SkeletonView(this.sceneManager);
    this.dynamicStringView = new DynamicStringView(this.sceneManager);
    this.anchoredStringsView = new AnchoredStringsView(
      this.sceneManager,
      this.config.strings.maxStrings,
      {
        segmentsPerString: this.perfProfile.stringSegments,
        renderCenterLine: this.perfProfile.renderWaveCenterLine,
        renderGhostTrail: this.perfProfile.renderGhostTrail,
      }
    );
    this.sparkParticlePool = new SparkParticlePool(
      this.sceneManager.scene,
      this.perfProfile.maxParticles
    );
    this.pluckShockwavePool = new PluckShockwavePool(this.sceneManager.scene);

    // 3. Audio & Musical Harmony Subsystems
    this.scaleMapper = new ScaleMapper(this.config.audio.defaultScale, this.config.audio.pitchMode);
    this.audioEngine = new AudioEngine({
      volume: this.config.audio.volumeDb,
      reverbWet: this.config.audio.reverbWet,
      reverbDecay: this.perfProfile.reverbDecaySec,
      delayWet: this.config.audio.delayWet,
      polyphony: this.perfProfile.audioPolyphony,
      preset: this.config.audio.defaultPreset,
    });
    this.collisionDetector = new StringCollisionDetector(this.scaleMapper);

    // 4. Instruments Subsystem: Mid-air Spatial String Manager
    this.spatialStringManager = new SpatialStringManager(this.sceneManager, {
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
      initialPitchMode: this.config.audio.pitchMode,
      onPitchModeChange: (pitchMode) => {
        this.setPitchMode(pitchMode, true);
      },
      onOpenAbout: (opener) => {
        this.aboutModal.open(opener);
      },
      onClose: () => {
        this.navBar.setActiveTab('instrument');
      },
    });

    this.tutorialModal = new TutorialModal(this.container, () => {
      this.navBar.setActiveTab('instrument');
    });
    this.aboutModal = new AboutModal(this.container);
    this.handPrompt = new HandPrompt(this.container);

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
      onOpenGuide: () => {
        if (this.spatialStringManager.count === 0) {
          this.spawnStarterStringSafe();
        }
        this.handPrompt.activate(true);
      },
      onOpenAbout: (opener) => {
        this.closeOpenDrawers();
        this.aboutModal.open(opener);
      },
      onClearStrings: () => {
        this.spatialStringManager.clearAll();
      },
    });

    this.hud = new HUD(this.container, (expanded) => {
      this.navBar.setDiagnosticsActive(expanded);
    });

    // Initial Splash Screen: clicking START explicitly requests camera & unlocks Web Audio
    this.splashScreen = new SplashScreen(this.container, {
      onStart: async () => {
        await this.startExperience();
      },
    });

    // Persistent sticky bottom-right About / version trigger button
    const versionBadge = document.createElement('button');
    versionBadge.type = 'button';
    versionBadge.id = 'app-version-badge';
    versionBadge.title = 'About Spatial Harp';
    versionBadge.setAttribute('aria-label', `About Spatial Harp, version ${__APP_VERSION__}`);
    versionBadge.textContent = `About · v${__APP_VERSION__}`;
    versionBadge.addEventListener('click', () => {
      this.closeOpenDrawers();
      this.aboutModal.open(versionBadge);
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
        const w1 = this.sceneManager.toWorldCoords(targetStr.point1.x, targetStr.point1.y, targetStr.point1.z, videoAspect, this.sparkW1);
        const w2 = this.sceneManager.toWorldCoords(targetStr.point2.x, targetStr.point2.y, targetStr.point2.z, videoAspect, this.sparkW2);

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
        this.sceneManager.toWorldCoords(pt.x, pt.y, pt.z, videoAspect, this.sparkOrigin);
        this.sparkNormal.set(0, 1, 0);
        this.pluckShockwavePool.emitShockwave(this.sparkOrigin, 0x38ef7d, 0.9);
        this.sparkParticlePool.emitBurst(this.sparkOrigin, this.sparkNormal, 0x00f0ff, 0.85);
      };

      emitPopAt(event.point1);
      this.audioEngine.playAnchorPop();
    });

    // 6c. Interactive 3-step coach progression listeners
    globalBus.on('string:anchored', () => {
      if (!this.isSpawningStarter) {
        this.handPrompt.markStringCreated();
      }
    });

    globalBus.on('string:grabbed', () => {
      this.handPrompt.markEndpointGrabbed();
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
      } else if (e.key === 'Escape') {
        this.closeOpenDrawers();
      }
    });

    // Light-dismiss any open floating drawer when clicking or tapping outside on desktop & mobile
    document.addEventListener('pointerdown', (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest('#sound-studio-panel') ||
        target.closest('#settings-panel') ||
        target.closest('#hud-card') ||
        target.closest('#app-fps-badge') ||
        target.closest('#app-navbar') ||
        target.closest('#tutorial-modal-dialog') ||
        target.closest('#about-modal-dialog')
      ) {
        return;
      }
      this.closeOpenDrawers();
    });
  }

  private closeOpenDrawers(): void {
    if (this.soundStudioPanel.getIsOpen() || this.settingsPanel.getIsOpen()) {
      this.soundStudioPanel.close();
      this.settingsPanel.close();
      this.navBar.setActiveTab('instrument');
    }
    if (this.hud.getIsExpanded()) {
      this.hud.setCardExpanded(false);
    }
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
    this.sparkParticlePool.configure(
      this.perfProfile.tier === 'mobile'
        ? {
            ...cfg.visuals,
            contactSparkBurstCount: Math.min(cfg.visuals.contactSparkBurstCount, this.perfProfile.sparkBurstCount),
            waveGlitterParticleCount: Math.min(cfg.visuals.waveGlitterParticleCount, this.perfProfile.waveGlitterCount),
          }
        : cfg.visuals
    );

    // 6. Sync Sound Studio & Settings with loaded config
    this.soundStudioPanel.setSelectedPreset(cfg.audio.defaultPreset);
    this.soundStudioPanel.setFxParams(this.audioEngine.getFxParams());
    this.settingsPanel.setPitchMode(cfg.audio.pitchMode);
  }

  private setPitchMode(mode: PitchMode, persist = true): void {
    this.config.audio.pitchMode = mode;
    this.scaleMapper.setPitchMode(mode);
    this.settingsPanel.setPitchMode(mode);
    if (persist) {
      saveUserOverride({ pitchMode: mode });
    }
  }

  private spawnStarterStringSafe(): void {
    this.isSpawningStarter = true;
    try {
      this.spatialStringManager.spawnStarterString(this.cameraManager.aspectRatio, performance.now());
    } finally {
      this.isSpawningStarter = false;
    }
  }

  private async unlockAudio(): Promise<void> {
    await this.audioEngine.unlock();
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
      const camWidth =
        this.perfProfile.tier === 'mobile'
          ? Math.min(this.config.vision.cameraWidth, this.perfProfile.cameraWidth)
          : this.config.vision.cameraWidth;
      const camHeight =
        this.perfProfile.tier === 'mobile'
          ? Math.min(this.config.vision.cameraHeight, this.perfProfile.cameraHeight)
          : this.config.vision.cameraHeight;
      await this.cameraManager.start({
        width: camWidth,
        height: camHeight,
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
      this.hud.setMessage('Hold pinch steady to draw a string, or grab string tips with one or both hands.');

      // 4. Start main RAF tick loop
      if (!this.isLoopInitialized) {
        this.loop.add((delta, elapsed) => this.tick(elapsed, delta));
        this.isLoopInitialized = true;
      }
      this.loop.start();
      if (!this.handPrompt.hasCompletedOnboarding() && this.spatialStringManager.count === 0) {
        this.spawnStarterStringSafe();
      }
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
    this.spatialStringManager.update(gestureStates, videoAspect, nowMs);
    const anchoredStrings = this.spatialStringManager.getStrings();
    const activeGrabs = this.spatialStringManager.getActiveGrabs();
    const previewState = this.spatialStringManager.getPreviewState();

    // Update interactive 3-step hand coach (zero-GC)
    this.handPrompt.update(
      hands.length,
      this.spatialStringManager.isChargingAnchor,
      previewState.isActive,
      anchoredStrings.length,
      nowMs
    );

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
      this.dynamicStringView.setVisible(true);
      this.dynamicStringView.update(gestureStates, previewState, videoAspect, elapsed);
    } else {
      this.dynamicStringView.setVisible(false);
    }

    // 7. Update anchored spatial strings (straight baseline, sinusoidal rainbow wave, echo contours & crosshairs)
    this.anchoredStringsView.update(anchoredStrings, activeGrabs, videoAspect, elapsed);

    // 8. Update GPU spark particles & starburst rays physics
    this.sparkParticlePool.update(delta);
    this.pluckShockwavePool.update(delta);

    // 9. Update HUD diagnostics & NavBar string count (zero-GC)
    this.navBar.setStringCount(anchoredStrings.length, this.spatialStringManager.maxCapacity);
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
