import * as THREE from 'three';

export class SceneManager {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.OrthographicCamera;
  public width = window.innerWidth;
  public height = window.innerHeight;
  public aspect = window.innerWidth / window.innerHeight;

  constructor(container: HTMLElement) {
    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();

    // Normalized Orthographic Camera
    // Height is normalized to 1.0 (-0.5 to 0.5), width scaled by aspect ratio
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
  }

  /**
   * Converts normalized 2D/3D camera coords (0..1, 0..1) to Three.js world coordinates
   * respecting video aspect fit/cover.
   */
  public toWorldCoords(normX: number, normY: number, normZ = 0, videoAspect = 16 / 9): THREE.Vector3 {
    // "Contain" / "Cover" mode for video frame matching
    // We match the video display size on screen
    const screenAspect = this.aspect;
    let renderW = screenAspect;
    let renderH = 1.0;

    if (screenAspect > videoAspect) {
      // Screen is wider than video: letterbox horizontally or fit height
      renderW = videoAspect;
      renderH = 1.0;
    } else {
      // Screen is taller than video: fit width
      renderW = screenAspect;
      renderH = screenAspect / videoAspect;
    }

    const worldX = (normX - 0.5) * renderW;
    const worldY = (0.5 - normY) * renderH;
    const worldZ = -normZ * 0.5;

    return new THREE.Vector3(worldX, worldY, worldZ);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
