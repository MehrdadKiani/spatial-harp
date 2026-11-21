import * as THREE from 'three';
import { ShockwaveState } from '../types/physics';

export class PluckShockwavePool {
  private group: THREE.Group;
  private maxShockwaves = 10;
  private shockwaves: ShockwaveState[] = [];

  // 1. Subtle brief neon contact shimmer at exact strike point
  private flashMeshes: THREE.Mesh[] = [];
  private flashMaterials: THREE.MeshBasicMaterial[] = [];

  // 2. Delicate, highly transparent expanding ripple ring
  private meshes: THREE.Mesh[] = [];
  private materials: THREE.MeshBasicMaterial[] = [];

  // 3. Faint secondary outer ripple ring
  private outerMeshes: THREE.Mesh[] = [];
  private outerMaterials: THREE.MeshBasicMaterial[] = [];

  private nextIndex = 0;
  private tempColor = new THREE.Color();
  private rippleColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Delicate, thin geometries so contact ripple feels airy and transparent
    const flashGeometry = new THREE.CircleGeometry(0.007, 20);
    const ringGeometry = new THREE.RingGeometry(0.0095, 0.011, 32);
    const outerRingGeometry = new THREE.RingGeometry(0.0115, 0.0125, 32);

    for (let i = 0; i < this.maxShockwaves; i++) {
      // 1. Contact flash disc (very light & transparent)
      const flashMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const flashMesh = new THREE.Mesh(flashGeometry, flashMat);
      flashMesh.visible = false;
      this.group.add(flashMesh);
      this.flashMeshes.push(flashMesh);
      this.flashMaterials.push(flashMat);

      // 2. Primary delicate energy ring
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(ringGeometry, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.meshes.push(mesh);
      this.materials.push(mat);

      // 3. Faint outer ripple ring
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0xd946ef,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const outerMesh = new THREE.Mesh(outerRingGeometry, outerMat);
      outerMesh.visible = false;
      this.group.add(outerMesh);
      this.outerMeshes.push(outerMesh);
      this.outerMaterials.push(outerMat);

      this.shockwaves.push({
        id: i,
        x: 0,
        y: 0,
        z: 0,
        radius: 0.01,
        maxRadius: 0.045,
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
   * Spawns a very light, transparent contact shimmer and delicate ripple ring at the pluck point
   */
  public emitShockwave(origin: THREE.Vector3, hexColor: number, velocity: number): void {
    const idx = this.nextIndex;
    const sw = this.shockwaves[idx];
    const flashMesh = this.flashMeshes[idx];
    const flashMat = this.flashMaterials[idx];
    const mesh = this.meshes[idx];
    const mat = this.materials[idx];
    const outerMesh = this.outerMeshes[idx];
    const outerMat = this.outerMaterials[idx];

    this.nextIndex = (this.nextIndex + 1) % this.maxShockwaves;

    this.tempColor.setHex(hexColor);
    this.rippleColor.setRGB(
      Math.min(1.0, this.tempColor.r * 0.6 + 0.4),
      Math.min(1.0, this.tempColor.g * 0.3 + 0.1),
      1.0
    );

    sw.active = true;
    sw.x = origin.x;
    sw.y = origin.y;
    sw.z = origin.z;
    sw.elapsed = 0;
    sw.duration = 0.24 + 0.10 * velocity;
    sw.maxRadius = 0.032 + 0.022 * velocity;
    // Very light and transparent peak opacity
    sw.alpha = 0.22;

    // 1. Subtle contact flash (~0.18 max opacity)
    flashMesh.position.set(origin.x, origin.y, origin.z + 0.003);
    flashMesh.scale.set(0.6, 0.6, 1.0);
    flashMat.color.copy(this.tempColor);
    flashMat.opacity = 0.18;
    flashMesh.visible = true;

    // 2. Primary hairline shockwave ring (~0.22 max opacity)
    mesh.position.set(origin.x, origin.y, origin.z + 0.002);
    mesh.scale.set(0.35, 0.35, 1.0);
    mat.color.copy(this.tempColor);
    mat.opacity = sw.alpha;
    mesh.visible = true;

    // 3. Faint secondary ripple (~0.12 max opacity)
    outerMesh.position.set(origin.x, origin.y, origin.z + 0.001);
    outerMesh.scale.set(0.25, 0.25, 1.0);
    outerMat.color.copy(this.rippleColor);
    outerMat.opacity = sw.alpha * 0.55;
    outerMesh.visible = true;
  }

  /**
   * Advances contact flash and shockwave ripple animation loop (Zero-GC)
   */
  public update(delta: number): void {
    for (let i = 0; i < this.maxShockwaves; i++) {
      const sw = this.shockwaves[i];
      if (!sw.active) continue;

      sw.elapsed += delta;
      const progress = sw.elapsed / sw.duration;

      if (progress >= 1.0) {
        sw.active = false;
        this.flashMeshes[i].visible = false;
        this.meshes[i].visible = false;
        this.outerMeshes[i].visible = false;
        continue;
      }

      // 1. Subtle brief neon flash (~90ms)
      const flashDuration = 0.09;
      if (sw.elapsed < flashDuration) {
        const flashProg = sw.elapsed / flashDuration;
        const flashScale = 0.6 + Math.sin(flashProg * Math.PI) * 0.65;
        this.flashMeshes[i].scale.set(flashScale, flashScale, 1.0);
        this.flashMaterials[i].opacity = Math.pow(1.0 - flashProg, 1.6) * 0.18;
      } else {
        this.flashMeshes[i].visible = false;
      }

      // 2. Primary hairline ring expansion
      const easePrimary = 1.0 - Math.pow(1.0 - progress, 2.2);
      const primaryScale = 0.35 + easePrimary * (sw.maxRadius / 0.011);
      this.meshes[i].scale.set(primaryScale, primaryScale, 1.0);
      this.materials[i].opacity = Math.pow(1.0 - progress, 1.8) * sw.alpha;

      // 3. Faint outer ripple expansion
      const easeOuter = Math.sin((progress * Math.PI) / 2);
      const outerScale = 0.3 + easeOuter * ((sw.maxRadius * 1.25) / 0.012);
      this.outerMeshes[i].scale.set(outerScale, outerScale, 1.0);
      this.outerMaterials[i].opacity = Math.pow(1.0 - progress, 1.6) * sw.alpha * 0.55;
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
