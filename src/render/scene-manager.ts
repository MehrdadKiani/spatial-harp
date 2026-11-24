import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export interface SceneManagerOptions {
  maxPixelRatio?: number;
  antialias?: boolean;
}

export class SceneManager {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.OrthographicCamera;
  public width = window.innerWidth;
  public height = window.innerHeight;
  public aspect = window.innerWidth / window.innerHeight;
  private maxPixelRatio: number;

  // Post-processing UnrealBloom pipeline (lazily allocated only if enabled to save mobile GPU VRAM)
  public composer: EffectComposer | null = null;
  public bloomPass: UnrealBloomPass | null = null;
  public isBloomEnabled = false;

  constructor(container: HTMLElement, options: SceneManagerOptions = {}) {
    this.maxPixelRatio = options.maxPixelRatio ?? 2;
    const antialias = options.antialias ?? true;

    // WebGL Renderer with Alpha transparency for camera video visibility
    this.renderer = new THREE.WebGLRenderer({
      antialias,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxPixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();

    // Normalized Orthographic Camera
    this.camera = new THREE.OrthographicCamera(
      -this.aspect / 2,
      this.aspect / 2,
      0.5,
      -0.5,
      -10,
      10
    );
    this.camera.position.z = 1;

    // Ambient light and directional lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(0, 0, 5);
    this.scene.add(dirLight);

    window.addEventListener('resize', () => this.handleResize());
  }

  public setBloomEnabled(enabled: boolean): void {
    this.isBloomEnabled = enabled;
    if (enabled && !this.composer) {
      const renderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        samples: 2,
      });
      this.composer = new EffectComposer(this.renderer, renderTarget);

      const renderPass = new RenderPass(this.scene, this.camera);
      renderPass.clearAlpha = 0;
      this.composer.addPass(renderPass);

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(this.width, this.height),
        1.25,
        0.45,
        0.16
      );
      this.composer.addPass(this.bloomPass);

      const outputPass = new OutputPass();
      this.composer.addPass(outputPass);
    }
  }

  public handleResize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.aspect = this.width / this.height;

    this.camera.left = -this.aspect / 2;
    this.camera.right = this.aspect / 2;
    this.camera.top = 0.5;
    this.camera.bottom = -0.5;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxPixelRatio));
    if (this.composer) {
      this.composer.setSize(this.width, this.height);
    }
  }

  /**
   * Converts normalized 2D/3D camera coords (0..1, 0..1) to Three.js world coordinates
   * respecting video aspect fit/cover. Pass `target` to avoid per-frame Vector3 allocations.
   */
  public toWorldCoords(
    normX: number,
    normY: number,
    normZ = 0,
    videoAspect = 16 / 9,
    target?: THREE.Vector3
  ): THREE.Vector3 {
    const screenAspect = this.aspect;
    let renderW = screenAspect;
    let renderH = 1.0;

    if (screenAspect > videoAspect) {
      renderW = videoAspect;
      renderH = 1.0;
    } else {
      renderW = screenAspect;
      renderH = screenAspect / videoAspect;
    }

    const worldX = (normX - 0.5) * renderW;
    const worldY = (0.5 - normY) * renderH;
    const worldZ = -normZ * 0.5;

    if (target) {
      return target.set(worldX, worldY, worldZ);
    }
    return new THREE.Vector3(worldX, worldY, worldZ);
  }

  public render(): void {
    if (this.isBloomEnabled && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
