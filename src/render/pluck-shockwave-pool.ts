import * as THREE from 'three';
import { ShockwaveState } from '../types/physics';

export class PluckShockwavePool {
  private group: THREE.Group;
  private maxShockwaves = 8;
  private shockwaves: ShockwaveState[] = [];
  private meshes: THREE.Mesh[] = [];
  private materials: THREE.MeshBasicMaterial[] = [];
  private nextIndex = 0;
  private tempColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Pre-allocate ring geometry (outer radius 0.012, inner radius 0.008)
    const geometry = new THREE.RingGeometry(0.008, 0.013, 32);

    for (let i = 0; i < this.maxShockwaves; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, mat);
      mesh.visible = false;
      this.group.add(mesh);

      this.meshes.push(mesh);
      this.materials.push(mat);

      this.shockwaves.push({
        id: i,
        x: 0,
        y: 0,
        z: 0,
        radius: 0.01,
        maxRadius: 0.08,
        r: 1,
        g: 1,
        b: 1,
        alpha: 0,
        elapsed: 0,
        duration: 0.28,
        active: false,
      });
    }
  }

  /**
   * Spawns an expanding circular shockwave ripple at the pluck contact point
   */
  public emitShockwave(origin: THREE.Vector3, hexColor: number, velocity: number): void {
    const sw = this.shockwaves[this.nextIndex];
    const mesh = this.meshes[this.nextIndex];
    const mat = this.materials[this.nextIndex];
    this.nextIndex = (this.nextIndex + 1) % this.maxShockwaves;

    this.tempColor.setHex(hexColor);

    sw.active = true;
    sw.x = origin.x;
    sw.y = origin.y;
    sw.z = origin.z;
    sw.elapsed = 0;
    sw.duration = 0.25 + 0.10 * velocity; // 250ms - 350ms duration
    sw.maxRadius = 0.055 + 0.035 * velocity;
    sw.alpha = 0.95;

    mesh.position.set(origin.x, origin.y, origin.z + 0.002);
    mesh.scale.set(0.4, 0.4, 1.0);
    mat.color.copy(this.tempColor);
    mat.opacity = sw.alpha;
    mesh.visible = true;
  }

  /**
   * Advances shockwave animation loop (Zero-GC)
   */
  public update(delta: number): void {
    for (let i = 0; i < this.maxShockwaves; i++) {
      const sw = this.shockwaves[i];
      if (!sw.active) continue;

      sw.elapsed += delta;
      const progress = sw.elapsed / sw.duration;

      if (progress >= 1.0) {
        sw.active = false;
        this.meshes[i].visible = false;
        continue;
      }

      // Eased expansion curve (rapid initial expansion, easing out)
      const ease = Math.sin((progress * Math.PI) / 2);
      const currentScale = 0.4 + ease * (sw.maxRadius / 0.012);

      this.meshes[i].scale.set(currentScale, currentScale, 1.0);

      // Fade out smoothly: (1 - progress)^1.4
      const fade = Math.pow(1.0 - progress, 1.4);
      this.materials[i].opacity = fade * sw.alpha;
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
