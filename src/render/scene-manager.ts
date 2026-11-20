import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class SceneManager {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.OrthographicCamera;
  public width = window.innerWidth;
  public height = window.innerHeight;
  public aspect = window.innerWidth / window.innerHeight;

  // Post-processing UnrealBloom pipeline (disabled by default to maintain 100% transparent video background)
  public composer: EffectComposer;
  public bloomPass: UnrealBloomPass;
  public isBloomEnabled = false;

  constructor(container: HTMLElement) {
    // WebGL Renderer with Alpha transparency for camera video visibility
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

    // Post-Processing Pipeline: EffectComposer with HalfFloat RGBA RenderTarget
    const renderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      samples: 2,
    });
    this.composer = new EffectComposer(this.renderer, renderTarget);

    const renderPass = new RenderPass(this.scene, this.camera);
    renderPass.clearAlpha = 0;
    this.composer.addPass(renderPass);

    // Neon UnrealBloom Pass (tuned for laser aesthetics and transparent alpha preservation)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      1.25, // strength
      0.45, // radius
      0.16  // threshold
    );
    this.composer.addPass(this.bloomPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    window.addEventListener('resize', () => this.handleResize());
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
    this.composer.setSize(this.width, this.height);
  }

  /**
   * Converts normalized 2D/3D camera coords (0..1, 0..1) to Three.js world coordinates
   * respecting video aspect fit/cover.
   */
  public toWorldCoords(normX: number, normY: number, normZ = 0, videoAspect = 16 / 9): THREE.Vector3 {
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

    return new THREE.Vector3(worldX, worldY, worldZ);
  }

  public render(): void {
    if (this.isBloomEnabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
